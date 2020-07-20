"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = encodeQuery;

var _rambdax = require("rambdax");

var _identical = _interopRequireDefault(require("../../../../utils/fp/identical"));

var _objOf = _interopRequireDefault(require("../../../../utils/fp/objOf"));

var _cond = _interopRequireDefault(require("../../../../utils/fp/cond"));

var _invariant = _interopRequireDefault(require("../../../../utils/common/invariant"));

var _likeToRegexp = _interopRequireDefault(require("../../../../utils/fp/likeToRegexp"));

var _Schema = require("../../../../Schema");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable no-use-before-define */
var getComparisonRight = (0, _cond.default)([[(0, _rambdax.has)('value'), (0, _rambdax.prop)('value')], [(0, _rambdax.has)('values'), (0, _rambdax.prop)('values')], [(0, _rambdax.has)('column'), (0, _rambdax.prop)('column')]]); // TODO: It's probably possible to improve performance of those operators by making them
// binary-search compatible (i.e. don't use $and, $not)
// TODO: We might be able to use $jgt, $jbetween, etc. — but ensure the semantics are right
// and it won't break indexing

var weakNotEqual = function (value) {
  return {
    $not: {
      $aeq: value
    }
  };
};

var noNullComparisons = function (operator) {
  return function (value) {
    return {
      $and: [operator(value), weakNotEqual(null)]
    };
  };
};

var like = function (value) {
  if ('string' === typeof value) {
    return {
      $regex: (0, _likeToRegexp.default)(value)
    };
  }

  return {};
};

var notLike = function (value) {
  if ('string' === typeof value) {
    return {
      $and: [{
        $not: {
          $eq: null
        }
      }, {
        $not: {
          $regex: (0, _likeToRegexp.default)(value)
        }
      }]
    };
  }

  return {};
};

var operators = {
  eq: (0, _objOf.default)('$aeq'),
  notEq: weakNotEqual,
  gt: (0, _objOf.default)('$gt'),
  gte: (0, _objOf.default)('$gte'),
  weakGt: (0, _objOf.default)('$gt'),
  // Note: yup, this is correct (for non-column comparisons)
  lt: noNullComparisons((0, _objOf.default)('$lt')),
  lte: noNullComparisons((0, _objOf.default)('$lte')),
  oneOf: (0, _objOf.default)('$in'),
  notIn: noNullComparisons((0, _objOf.default)('$nin')),
  between: (0, _objOf.default)('$between'),
  like: like,
  notLike: notLike
};
var operatorsColumnComparison = {
  eq: (0, _objOf.default)('$$aeq'),
  notEq: function notEq(value) {
    return {
      $not: {
        $$aeq: value
      }
    };
  },
  gt: (0, _objOf.default)('$$gt'),
  gte: (0, _objOf.default)('$$gte'),
  weakGt: (0, _objOf.default)('$$gt'),
  lt: noNullComparisons((0, _objOf.default)('$$lt')),
  lte: noNullComparisons((0, _objOf.default)('$$lte'))
};
var columnCompRequiresColumnNotNull = {
  gt: true,
  gte: true,
  lt: true,
  lte: true
};

var encodeWhereDescription = function ({
  left: left,
  comparison: {
    operator: operator,
    right: right
  }
}) {
  var comparisonRight = getComparisonRight(right);

  if ('string' === typeof right.value) {
    // we can do fast path as we know that eq and aeq do the same thing for strings
    if ('eq' === operator) {
      return (0, _objOf.default)(left, {
        $eq: comparisonRight
      });
    } else if ('notEq' === operator) {
      return (0, _objOf.default)(left, {
        $ne: comparisonRight
      });
    }
  }

  var colName = right.column;
  var opFn = colName ? operatorsColumnComparison[operator] : operators[operator];
  var comparison = opFn(comparisonRight);

  if (colName && columnCompRequiresColumnNotNull[operator]) {
    return {
      $and: [(0, _objOf.default)(left, comparison), (0, _objOf.default)(colName, weakNotEqual(null))]
    };
  }

  return (0, _objOf.default)(left, comparison);
};

var encodeCondition = function (associations) {
  return function (clause) {
    switch (clause.type) {
      case 'and':
        return encodeAnd(associations, clause);

      case 'or':
        return encodeOr(associations, clause);

      case 'where':
        return encodeWhereDescription(clause);

      case 'on':
        return encodeJoin(associations, clause);

      case 'loki':
        return clause.expr;

      default:
        throw new Error("Unknown clause ".concat(clause.type));
    }
  };
};

var encodeConditions = function (associations) {
  return function (conditions) {
    return conditions.map(encodeCondition(associations));
  };
};

var encodeAndOr = function (op) {
  return function (associations, clause) {
    var _ref;

    var conditions = encodeConditions(associations)(clause.conditions); // flatten

    return 1 === conditions.length ? conditions[0] : (_ref = {}, _ref[op] = conditions, _ref);
  };
};

var encodeAnd = encodeAndOr('$and');
var encodeOr = encodeAndOr('$or');

var lengthEq = function (n) {
  return (0, _rambdax.pipe)(_rambdax.length, (0, _identical.default)(n));
}; // Note: empty query returns `undefined` because
// Loki's Collection.count() works but count({}) doesn't


var concatRawQueries = (0, _cond.default)([[lengthEq(0), (0, _rambdax.always)(undefined)], [lengthEq(1), _rambdax.head], [_rambdax.T, (0, _objOf.default)('$and')]]);

var encodeRootConditions = function (associations) {
  return (0, _rambdax.pipe)(encodeConditions(associations), concatRawQueries);
};

var encodeMapKey = (0, _rambdax.ifElse)((0, _rambdax.propEq)('type', 'belongs_to'), (0, _rambdax.always)((0, _Schema.columnName)('id')), (0, _rambdax.prop)('foreignKey'));
var encodeJoinKey = (0, _rambdax.ifElse)((0, _rambdax.propEq)('type', 'belongs_to'), (0, _rambdax.prop)('key'), (0, _rambdax.always)((0, _Schema.columnName)('id')));

var encodeJoin = function (associations, on) {
  var {
    table: table,
    conditions: conditions
  } = on;
  var association = associations.find(function ({
    to: to
  }) {
    return table === to;
  });
  (0, _invariant.default)(association, 'To nest Q.on inside Q.and/Q.or you must explicitly declare Q.experimentalJoinTables at the beginning of the query');
  return {
    $join: {
      table: table,
      query: encodeRootConditions(associations)(conditions),
      mapKey: encodeMapKey(association.info),
      joinKey: encodeJoinKey(association.info)
    }
  };
};

function encodeQuery(query) {
  var {
    table: table,
    description: {
      where: where,
      joinTables: joinTables,
      sortBy: sortBy,
      take: take
    },
    associations: associations
  } = query; // TODO: implement support for Q.sortBy(), Q.take(), Q.skip() for Loki adapter

  (0, _invariant.default)(!sortBy.length, '[WatermelonDB][Loki] Q.sortBy() not yet supported');
  (0, _invariant.default)(!take, '[WatermelonDB][Loki] Q.take() not yet supported');
  return {
    table: table,
    query: encodeRootConditions(associations)(where),
    hasJoins: !!joinTables.length
  };
}