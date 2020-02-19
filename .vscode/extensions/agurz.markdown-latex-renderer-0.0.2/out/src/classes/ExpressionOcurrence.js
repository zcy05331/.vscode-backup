"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Expression {
    constructor(expression, position) {
        this.expression = expression;
        this.position = position;
    }
    getString() {
        return this.expression;
    }
    getPosition() {
        return this.position;
    }
}
exports.Expression = Expression;
//# sourceMappingURL=ExpressionOcurrence.js.map