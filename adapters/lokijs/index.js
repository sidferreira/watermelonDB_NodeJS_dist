"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _common = require("../../utils/common");

var _common2 = require("../common");

var _WorkerBridge = _interopRequireDefault(require("./WorkerBridge"));

var _common3 = require("./common");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var {
  SETUP: SETUP,
  FIND: FIND,
  QUERY: QUERY,
  COUNT: COUNT,
  BATCH: BATCH,
  UNSAFE_RESET_DATABASE: UNSAFE_RESET_DATABASE,
  GET_LOCAL: GET_LOCAL,
  SET_LOCAL: SET_LOCAL,
  REMOVE_LOCAL: REMOVE_LOCAL,
  GET_DELETED_RECORDS: GET_DELETED_RECORDS,
  DESTROY_DELETED_RECORDS: DESTROY_DELETED_RECORDS
} = _common3.actions;

var LokiJSAdapter =
/*#__PURE__*/
function () {
  function LokiJSAdapter(options) {
    var _options$useWebWorker;

    var {
      schema: schema,
      migrations: migrations,
      dbName: dbName
    } = options;
    var useWebWorker = null !== (_options$useWebWorker = options.useWebWorker) && void 0 !== _options$useWebWorker ? _options$useWebWorker : 'test' !== process.env.NODE_ENV;
    this.workerBridge = new _WorkerBridge.default(useWebWorker);
    this.schema = schema;
    this.migrations = migrations;
    this._dbName = dbName;

    if ('production' !== process.env.NODE_ENV) {
      if (!('useWebWorker' in options)) {
        _common.logger.warn('LokiJSAdapter `useWebWorker` option will become required in a future version of WatermelonDB. Pass `{ useWebWorker: false }` to adopt the new behavior, or `{ useWebWorker: true }` to supress this warning with no changes');
      }

      if (!('useIncrementalIndexedDB' in options)) {
        _common.logger.warn('LokiJSAdapter `useIncrementalIndexedDB` option will become required in a future version of WatermelonDB. Pass `{ useIncrementalIndexedDB: true }` to adopt the new behavior, or `{ useIncrementalIndexedDB: false }` to supress this warning with no changes');
      }

      (0, _common.invariant)(!('migrationsExperimental' in options), 'LokiJSAdapter `migrationsExperimental` option has been renamed to `migrations`');
      (0, _common.invariant)(!('experimentalUseIncrementalIndexedDB' in options), 'LokiJSAdapter `experimentalUseIncrementalIndexedDB` option has been renamed to `useIncrementalIndexedDB`');
      (0, _common2.validateAdapter)(this);
    }

    this.workerBridge.send(SETUP, [options], _common2.devSetupCallback, 'immutable', 'immutable');
  }

  var _proto = LokiJSAdapter.prototype;

  _proto.testClone = function testClone(options = {}) {
    return new Promise(function ($return) {
      // Ensure data is saved to memory
      // $FlowFixMe
      var {
        executor: executor
      } = this.workerBridge._worker._worker;
      executor.loki.close(); // Copy

      var lokiAdapter = executor.loki.persistenceAdapter;
      return $return(new LokiJSAdapter(_objectSpread({
        dbName: this._dbName,
        schema: this.schema
      }, this.migrations ? {
        migrations: this.migrations
      } : {}, {
        _testLokiAdapter: lokiAdapter
      }, options)));
    }.bind(this));
  };

  _proto.find = function find(table, id, callback) {
    (0, _common2.validateTable)(table, this.schema);
    this.workerBridge.send(FIND, [table, id], callback, 'immutable', 'shallowCloneDeepObjects');
  };

  _proto.query = function query(_query, callback) {
    (0, _common2.validateTable)(_query.table, this.schema); // SerializedQueries are immutable, so we need no copy

    this.workerBridge.send(QUERY, [_query], callback, 'immutable', 'shallowCloneDeepObjects');
  };

  _proto.count = function count(query, callback) {
    (0, _common2.validateTable)(query.table, this.schema); // SerializedQueries are immutable, so we need no copy

    this.workerBridge.send(COUNT, [query], callback, 'immutable', 'immutable');
  };

  _proto.batch = function batch(operations, callback) {
    var _this = this;

    operations.forEach(function ([, table]) {
      return (0, _common2.validateTable)(table, _this.schema);
    }); // batches are only strings + raws which only have JSON-compatible values, rest is immutable

    this.workerBridge.send(BATCH, [operations], callback, 'shallowCloneDeepObjects', 'immutable');
  };

  _proto.getDeletedRecords = function getDeletedRecords(table, callback) {
    (0, _common2.validateTable)(table, this.schema);
    this.workerBridge.send(GET_DELETED_RECORDS, [table], callback, 'immutable', 'immutable');
  };

  _proto.destroyDeletedRecords = function destroyDeletedRecords(table, recordIds, callback) {
    (0, _common2.validateTable)(table, this.schema);
    this.workerBridge.send(DESTROY_DELETED_RECORDS, [table, recordIds], callback, 'immutable', 'immutable');
  };

  _proto.unsafeResetDatabase = function unsafeResetDatabase(callback) {
    this.workerBridge.send(UNSAFE_RESET_DATABASE, [], callback, 'immutable', 'immutable');
  };

  _proto.getLocal = function getLocal(key, callback) {
    this.workerBridge.send(GET_LOCAL, [key], callback, 'immutable', 'immutable');
  };

  _proto.setLocal = function setLocal(key, value, callback) {
    this.workerBridge.send(SET_LOCAL, [key, value], callback, 'immutable', 'immutable');
  };

  _proto.removeLocal = function removeLocal(key, callback) {
    this.workerBridge.send(REMOVE_LOCAL, [key], callback, 'immutable', 'immutable');
  };

  return LokiJSAdapter;
}();

exports.default = LokiJSAdapter;