"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.tableName = tableName;
exports.columnName = columnName;
exports.appSchema = appSchema;
exports.validateColumnSchema = validateColumnSchema;
exports.tableSchema = tableSchema;

var _invariant = _interopRequireDefault(require("../utils/common/invariant"));

var _checkName = _interopRequireDefault(require("../utils/fp/checkName"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function tableName(name) {
  return name;
}

function columnName(name) {
  return name;
}

function appSchema({
  version: version,
  tables: tableList
}) {
  'production' !== process.env.NODE_ENV && (0, _invariant.default)(0 < version, "Schema version must be greater than 0");
  var tables = tableList.reduce(function (map, table) {
    if ('production' !== process.env.NODE_ENV) {
      (0, _invariant.default)('object' === typeof table && table.name, "Table schema must contain a name");
    }

    map[table.name] = table;
    return map;
  }, {});
  return {
    version: version,
    tables: tables
  };
}

var validateName = function (name) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(!['id', '_changed', '_status', 'local_storage'].includes(name.toLowerCase()), "Invalid column or table name '".concat(name, "' - reserved by WatermelonDB"));
    (0, _checkName.default)(name);
  }
};

function validateColumnSchema(column) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(column.name, "Missing column name");
    validateName(column.name);
    (0, _invariant.default)(['string', 'boolean', 'number'].includes(column.type), "Invalid type ".concat(column.type, " for column '").concat(column.name, "' (valid: string, boolean, number)"));

    if ('created_at' === column.name || 'updated_at' === column.name) {
      (0, _invariant.default)('number' === column.type && !column.isOptional, "".concat(column.name, " must be of type number and not optional"));
    }

    if ('last_modified' === column.name) {
      (0, _invariant.default)('number' === column.type, "For compatibility reasons, column last_modified must be of type 'number', and should be optional");
    }
  }
}

function tableSchema({
  name: name,
  columns: columnArray
}) {
  if ('production' !== process.env.NODE_ENV) {
    (0, _invariant.default)(name, "Missing table name in schema");
    validateName(name);
  }

  var columns = columnArray.reduce(function (map, column) {
    if ('production' !== process.env.NODE_ENV) {
      validateColumnSchema(column);
    }

    map[column.name] = column;
    return map;
  }, {});
  return {
    name: name,
    columns: columns,
    columnArray: columnArray
  };
}