const balanceAmountEl = /**@type HTMLInputElement*/(document.getElementById('balanceAmount'));
const balanceToPayEl = /**@type HTMLInputElement*/(document.getElementById('balanceToPay'));
const balanceDueEl = /**@type HTMLInputElement*/(document.getElementById('balanceDue'));

const expenseRowsEl = /**@type HTMLTableSectionElement*/(document.getElementById('expenseRows'));

class CalculatedCell {
  /**
   * @param {object}               opts
   * @param {() => any}            opts.get
   * @param {(val: any) => string} opts.format
   * @param {Dependencies[]}       opts.dependsOn
   */
  constructor({ get, format, dependsOn }) {
    for (const dep of dependsOn) {
      dep.effects = this;
    }

    /** @type {Effected} */
    this.effects = null;

    this.get = get;
    this.format = format;

    this.td = document.createElement('td');
    this.td.classList.add('cell');
    this.refresh();
  }

  refresh() {
    this.value = this.get();
    this.td.innerText = this.format(this.value);

    if (this.effects) {
      this.effects.refresh();
    }
  }
}

class InputCell {
  /**
   * @param {object}               opts
   * @param {any}                  opts.initial
   * @param {(val: any) => string} opts.format
   * @param {(s: string) => any}   opts.parse
   */
  constructor({ initial, format, parse }) {
    /** @type {Effected} */
    this.effects = null;

    this.value = initial;
    this.format = format;

    this.td = document.createElement('td');
    this.input = document.createElement('input');
    this.input.classList.add('cell');

    this.input.value = format(this.value);

    this.input.onblur = () => {
      this.input.value = format(this.value);
      this.input.blur();
    };

    this.input.onkeydown = (e) => {
      if (e.keyCode === 13) {
        const newVal = parse(this.input.value);
        if (this.value !== newVal) {
          doAction(new EditAction(this, this.value, newVal));
          this.input.blur();
        }
      }
      else if (e.keyCode === 27) {
        this.input.value = format(this.value);
        this.input.blur();
      }
    };

    this.td.append(this.input);
  }

  useValue(/** @type {any} */ val) {
    this.value = val;
    this.input.value = this.format(this.value);
    blink(this.input);

    if (this.effects) {
      this.effects.refresh();
    }
  }
}

class Expense {
  constructor(/** @type {ExpenseData=} */ data) {
    this.tr = document.createElement('tr');
    expenseRowsEl.append(this.tr);

    this.nameCell = new InputCell({
      initial: data?.name ?? 'New Expense',
      format: s => s,
      parse: s => s,
    });

    this.amountCell = new InputCell({
      initial: data?.amount ?? 0,
      format: formatMoney,
      parse: parseMoney,
    });

    this.payPercentCell = new InputCell({
      initial: data?.payPercent ?? 1,
      format: formatPercent,
      parse: parsePercent,
    });

    this.toPayCell = new CalculatedCell({
      get: () => this.amountCell.value * this.payPercentCell.value,
      format: formatMoney,
      dependsOn: [this.amountCell, this.payPercentCell],
    });

    this.paidPercentCell = new InputCell({
      initial: data?.paidPercent ?? 0,
      format: formatPercent,
      parse: parsePercent,
    });

    this.dueCell = new CalculatedCell({
      get: () => this.toPayCell.value - (this.toPayCell.value * this.paidPercentCell.value),
      format: formatMoney,
      dependsOn: [this.toPayCell, this.paidPercentCell],
    });

    this.usuallyDueCell = new InputCell({
      initial: data?.usuallyDue ?? '',
      format: s => s,
      parse: s => s,
    });

    this.actuallyDueCell = new CalculatedCell({
      get: () => this.dueCell.value === 0 ? '-' : this.usuallyDueCell.value,
      format: formatMoney,
      dependsOn: [this.dueCell, this.usuallyDueCell],
    });

    this.tr.append(
      this.nameCell.td,
      this.amountCell.td,
      this.payPercentCell.td,
      this.toPayCell.td,
      this.paidPercentCell.td,
      this.dueCell.td,
      this.usuallyDueCell.td,
      this.actuallyDueCell.td,
    );
  }

  serialize() {
    return {
      name: this.nameCell.value,
      amount: this.amountCell.value,
      payPercent: this.payPercentCell.value,
      paidPercent: this.paidPercentCell.value,
      usuallyDue: this.usuallyDueCell.value,
    };
  }
}

/**
 * @typedef ExpenseLike
 * @property {*} tr
 */

/** @type {ExpenseLike[]} */
const expenses = [];

const balances = {
  amount: 10,
  toPay: 20,
  due: 30,
};

/**
 * @typedef Action
 * @property {() => void} undo
 * @property {() => void} redo
 */

/** @type {Action[]} */
const actions = [];
let nextAction = 0;

balanceAmountEl.value = formatMoney(balances.amount);
balanceToPayEl.value = formatMoney(balances.toPay);
balanceDueEl.value = formatMoney(balances.due);

setupChangeBalance(balanceAmountEl, 'amount');
setupChangeBalance(balanceToPayEl, 'toPay');
setupChangeBalance(balanceDueEl, 'due');

/**
 * @param {HTMLInputElement} el
 * @param {keyof balances} key
 */
function setupChangeBalance(el, key) {
  function cancel() {
    el.value = formatMoney(balances[key]);
    el.blur();
  }

  el.onblur = (e) => cancel();
  el.onkeydown = (e) => {
    if (e.keyCode === 13) {
      const newVal = parseMoney(el.value);
      if (balances[key] !== newVal) {
        doAction(new ChangeBalanceAction(el, key, newVal));
        el.blur();
      }
    }
    else if (e.keyCode === 27) {
      cancel();
    }
  };
}

function formatMoney(/** @type {number} */ amount) {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function parseMoney(/** @type {string} */ amount) {
  return Math.round(parseFloat(amount.replace(/\$/g, '')) * 100) / 100;
}

function formatPercent(/** @type {number} */ amount) {
  return Math.round(amount * 100).toString() + '%';
}

function parsePercent(/** @type {string} */ amount) {
  return Math.round(parseFloat(amount.replace(/%/g, ''))) / 100;
}

function addExpense() {
  doAction(new AddExpenseAction());
}

function addSpace() {
  doAction(new AddSpaceAction());
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

function undo() {
  if (nextAction === 0) return;
  const action = actions[--nextAction];
  action.undo();
}

function redo() {
  if (nextAction === actions.length) return;
  const action = actions[nextAction++];
  action.redo();
}

function doAction(/** @type {Action} */ action) {
  if (nextAction < actions.length) {
    actions.splice(nextAction);
  }

  actions.push(action);
  redo();
}

class ChangeBalanceAction {
  /**
   * @param {HTMLInputElement} el
   * @param {keyof balances} key
   * @param {number} newVal
   */
  constructor(el, key, newVal) {
    this.el = el;
    this.key = key;
    this.newVal = newVal;
    this.oldVal = balances[key];
  }

  undo() {
    balances[this.key] = this.oldVal;
    this.el.value = formatMoney(balances[this.key]);
    blink(this.el);
  }

  redo() {
    balances[this.key] = this.newVal;
    this.el.value = formatMoney(balances[this.key]);
    blink(this.el);
  }
}

class AddExpenseAction {
  constructor() {
    this.expense = new Expense();
  }

  undo() {
    expenses.splice(expenses.length - 1);
    expenseRowsEl.removeChild(this.expense.tr);
  }

  redo() {
    expenses.push(this.expense);
    expenseRowsEl.append(this.expense.tr);
    blink(this.expense.tr);
  }
}

class Space {
  constructor() {
    this.tr = document.createElement('tr');

    const td = document.createElement('td');
    td.innerHTML = '&nbsp;';
    td.colSpan = 8;
    td.className = 'empty';

    this.tr.append(td);
  }
}

class AddSpaceAction {
  constructor() {
    this.space = new Space();
  }

  undo() {
    expenses.splice(expenses.length - 1);
    expenseRowsEl.removeChild(this.space.tr);
  }

  redo() {
    expenses.push(this.space);
    expenseRowsEl.append(this.space.tr);
    blink(this.space.tr);
  }
}

class EditAction {
  /**
   * @param {InputCell}  cell
   * @param {any}        oldVal
   * @param {any}        newVal
   */
  constructor(cell, oldVal, newVal) {
    this.cell = cell;
    this.oldVal = oldVal;
    this.newVal = newVal;
  }

  undo() {
    this.cell.useValue(this.oldVal);
  }

  redo() {
    this.cell.useValue(this.newVal);
  }
}

/** @type {() => void} */
let cancelLastBlink = null;

function blink(/** @type {HTMLElement} */el) {
  if (cancelLastBlink) cancelLastBlink();

  setTimeout(() => el.classList.add('changed'), 20);
  const clearChange = () => el.classList.remove('changed');

  const stopBlink = setTimeout(() => {
    clearChange();
    cancelLastBlink = null;
  }, 1000);

  cancelLastBlink = () => {
    clearTimeout(stopBlink);
    clearChange();
  };
}

/**
 * @typedef ExpenseData
 * @property {string} name
 * @property {number} amount
 * @property {number} payPercent
 * @property {number} paidPercent
 * @property {string} usuallyDue
 */

/**
 * @typedef Effected
 * @property {() => void} refresh
 */

/**
 * @typedef Dependencies
 * @property {Effected} effects
 */
