#include "Database.h"
#include "DatabasePlatform.h"
#include "JSLockPerfHack.h"

namespace watermelondb {

using platform::consoleError;
using platform::consoleLog;

void assertCount(size_t count, size_t expected, std::string name) {
    if (count != expected) {
        std::string error = name + " takes " + std::to_string(expected) + " arguments";
        throw std::invalid_argument(error);
    }
}

jsi::Value withJSCLockHolder(facebook::jsi::Runtime &rt, std::function<jsi::Value(void)> block) {
    jsi::Value retValue;
    watermelonCallWithJSCLockHolder(rt, [&]() { retValue = block(); });
    return retValue;
}

using jsiFunction = std::function<jsi::Value(jsi::Runtime &rt, const jsi::Value *args)>;

jsi::Function createFunction(jsi::Runtime &runtime, const jsi::PropNameID &name, unsigned int argCount, jsiFunction func

                             ) {
    std::string stdName = name.utf8(runtime);
    return jsi::Function::createFromHostFunction(runtime, name, argCount,
                                                 [stdName, argCount, func](jsi::Runtime &rt, const jsi::Value &,
                                                                           const jsi::Value *args, size_t count) {
        assertCount(count, argCount, stdName);

        return func(rt, args);
    });
}

void createMethod(jsi::Runtime &rt, jsi::Object &object, const char *methodName, unsigned int argCount, jsiFunction func) {
    jsi::PropNameID name = jsi::PropNameID::forAscii(rt, methodName);
    jsi::Function function = createFunction(rt, name, argCount, func);
    object.setProperty(rt, name, function);
}

void Database::install(jsi::Runtime *runtime) {
    jsi::Runtime &rt = *runtime;
    auto globalObject = rt.global();
    createMethod(rt, globalObject, "nativeWatermelonCreateAdapter", 1, [runtime](jsi::Runtime &rt, const jsi::Value *args) {
        std::string dbPath = args[0].getString(rt).utf8(rt);

        jsi::Object adapter(rt);

        std::shared_ptr<Database> database = std::make_shared<Database>(runtime, dbPath);
        adapter.setProperty(rt, "database", jsi::Object::createFromHostObject(rt, database));

        createMethod(rt, adapter, "initialize", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            jsi::String dbName = args[0].getString(rt);
            int expectedVersion = (int)args[1].getNumber();

            int databaseVersion = database->getUserVersion();

            jsi::Object response(rt);

            if (databaseVersion == expectedVersion) {
                database->initialized_ = true;
                response.setProperty(rt, "code", "ok");
            } else if (databaseVersion == 0) {
                response.setProperty(rt, "code", "schema_needed");
            } else if (databaseVersion < expectedVersion) {
                response.setProperty(rt, "code", "migrations_needed");
                response.setProperty(rt, "databaseVersion", databaseVersion);
            } else {
                consoleLog("Database has newer version (" + std::to_string(databaseVersion) +
                           ") than what the app supports (" + std::to_string(expectedVersion) + "). Will reset database.");
                response.setProperty(rt, "code", "schema_needed");
            }

            return response;
        });
        createMethod(rt, adapter, "setUpWithSchema", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            jsi::String dbName = args[0].getString(rt);
            jsi::String schema = args[1].getString(rt);
            int schemaVersion = (int)args[2].getNumber();

            try {
                database->unsafeResetDatabase(schema, schemaVersion);
            } catch (const std::exception &ex) {
                consoleError("Failed to set up the database correctly - " + std::string(ex.what()));
                std::abort();
            }

            database->initialized_ = true;
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "setUpWithMigrations", 4, [database](jsi::Runtime &rt, const jsi::Value *args) {
            jsi::String dbName = args[0].getString(rt);
            jsi::String migrationSchema = args[1].getString(rt);
            int fromVersion = (int)args[2].getNumber();
            int toVersion = (int)args[3].getNumber();

            try {
                database->migrate(migrationSchema, fromVersion, toVersion);
            } catch (const std::exception &ex) {
                consoleError("Failed to migrate the database correctly - " + std::string(ex.what()));
                throw;
            }

            database->initialized_ = true;
            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "find", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String id = args[1].getString(rt);

            return withJSCLockHolder(rt, [&]() { return database->find(tableName, id); });
        });
        createMethod(rt, adapter, "query", 3, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::String sql = args[1].getString(rt);
            jsi::Array arguments = args[2].getObject(rt).getArray(rt);

            return withJSCLockHolder(rt, [&]() { return database->query(tableName, sql, arguments); });
        });
        createMethod(rt, adapter, "count", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String sql = args[0].getString(rt);
            jsi::Array arguments = args[1].getObject(rt).getArray(rt);

            return withJSCLockHolder(rt, [&]() { return database->count(sql, arguments); });
        });
        createMethod(rt, adapter, "batch", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::Array operations = args[0].getObject(rt).getArray(rt);

            watermelonCallWithJSCLockHolder(rt, [&]() { database->batch(operations); });

            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "getLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);

            return withJSCLockHolder(rt, [&]() { return database->getLocal(key); });
        });
        createMethod(rt, adapter, "setLocal", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);
            jsi::String value = args[1].getString(rt);

            return withJSCLockHolder(rt, [&]() {
                database->setLocal(key, value);
                return jsi::Value::undefined();
            });
        });
        createMethod(rt, adapter, "removeLocal", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String key = args[0].getString(rt);

            watermelonCallWithJSCLockHolder(rt, [&]() { database->removeLocal(key); });

            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "getDeletedRecords", 1, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);

            return withJSCLockHolder(rt, [&]() { return database->getDeletedRecords(tableName); });
        });
        createMethod(rt, adapter, "destroyDeletedRecords", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String tableName = args[0].getString(rt);
            jsi::Array recordIds = args[1].getObject(rt).getArray(rt);

            watermelonCallWithJSCLockHolder(rt, [&]() { database->destroyDeletedRecords(tableName, recordIds); });

            return jsi::Value::undefined();
        });
        createMethod(rt, adapter, "unsafeResetDatabase", 2, [database](jsi::Runtime &rt, const jsi::Value *args) {
            assert(database->initialized_);
            jsi::String schema = args[0].getString(rt);
            int schemaVersion = (int)args[1].getNumber();

            watermelonCallWithJSCLockHolder(rt, [&]() {
                try {
                    database->unsafeResetDatabase(schema, schemaVersion);
                } catch (const std::exception &ex) {
                    consoleError("Failed to reset database correctly - " + std::string(ex.what()));
                    // Partially reset database is likely corrupted, so it's probably less bad to crash
                    std::abort();
                }
            });

            return jsi::Value::undefined();
        });

        return adapter;
    });

    // TODO: Use the onMemoryAlert hook!
}


} // namespace watermelondb

