"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = performJoins;

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = null != arguments[i] ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function performJoinsImpl(query, performer) {
  if (!query) {
    return query;
  } else if (query.$join) {
    var _ref;

    var _join = query.$join;
    var joinQuery = performJoinsImpl(_join.query, performer);
    var records = performer(_objectSpread({}, _join, {
      query: joinQuery
    })); // for queries on `belongs_to` tables, matchingIds will be IDs of the parent table records
    //   (e.g. task: { project_id in ids })
    // and for `has_many` tables, it will be IDs of the main table records
    //   (e.g. task: { id in (ids from tag_assignment.task_id) })

    var matchingIds = records.map(function (record) {
      return record[_join.mapKey];
    });
    return _ref = {}, _ref[_join.joinKey] = {
      $in: matchingIds
    }, _ref;
  } else if (query.$and) {
    return {
      $and: query.$and.map(function (clause) {
        return performJoinsImpl(clause, performer);
      })
    };
  } else if (query.$or) {
    return {
      $or: query.$or.map(function (clause) {
        return performJoinsImpl(clause, performer);
      })
    };
  }

  return query;
}

function performJoins(lokiQuery, performer) {
  var {
    query: query,
    hasJoins: hasJoins
  } = lokiQuery;

  if (!hasJoins) {
    return query;
  }

  return performJoinsImpl(query, performer);
}