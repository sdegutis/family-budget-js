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

  add() {
    expenses.push(this);
    expenseRowsEl.append(this.tr);
  }

  remove() {
    expenses.splice(expenses.length - 1);
    expenseRowsEl.removeChild(this.tr);
  }

  blink() {
    blink(this.tr);
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
 * @typedef Item
 * @property {() => void} add
 * @property {() => void} remove
 * @property {() => void} blink
 */

/** @type {Item[]} */
const expenses = [];

let balances = {
  amount: 0,
  due: 0,
  toPay: 0,
};

/**
 * @typedef Action
 * @property {number}     id
 * @property {() => void} undo
 * @property {() => void} redo
 */

/** @type {Action[]} */
const actions = [];
let nextAction = 0;
let nextActionId = 0;
let makeActionId = () => ++nextActionId;
let cleanActionId = 0;

function isClean() {
  if (nextAction === 0) return cleanActionId === 0;
  return actions[nextAction - 1].id === cleanActionId;
}

function resetUndoStack() {
  actions.length = 0;
  nextAction = 0;
  nextActionId = 0;
  cleanActionId = 0;
}

function resetExpenses() {
  for (const expense of expenses) {
    expense.remove();
  }
  expenses.length = 0;
}

function openFile(/** @type {FileData} */json) {
  newFile();
  setupBalances(json.balances);
  for (const data of json.expenses) {
    if (data.space) {
      new Space().add();
    }
    else {
      new Expense(data).add();
    }
  }
}

function newFile() {
  resetUndoStack();
  resetExpenses();
  setupBalances({ amount: 0, due: 0, toPay: 0 });
}

/**s
 * @param {typeof balances} data
 */
function setupBalances(data) {
  balances = data;

  balanceAmountEl.value = formatMoney(balances.amount);
  balanceToPayEl.value = formatMoney(balances.toPay);
  balanceDueEl.value = formatMoney(balances.due);
}

setupBalances({
  amount: 0,
  due: 0,
  toPay: 0,
});

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
  doAction(new AddItemAction(new Expense()));
}

function addSpace() {
  doAction(new AddItemAction(new Space()));
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

function undo() {
  if (nextAction === 0) return;
  const action = actions[--nextAction];
  action.undo();
  sendToBackend('isClean', isClean());
}

function redo() {
  if (nextAction === actions.length) return;
  const action = actions[nextAction++];
  action.redo();
  sendToBackend('isClean', isClean());
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
    this.id = makeActionId();
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

class AddItemAction {
  /**
   * @param {Item} item
   */
  constructor(item) {
    this.id = makeActionId();
    this.item = item;
  }

  undo() {
    this.item.remove();
  }

  redo() {
    this.item.add();
    this.item.blink();
  }
}

class Space {
  constructor() {
    this.tr = document.createElement('tr');

    const td = document.createElement('td');
    td.innerHTML = '&nbsp;';
    td.colSpan = 8;
    td.className = 'empty cell';

    this.tr.append(td);
  }

  serialize() {
    return { space: true };
  }

  add() {
    expenses.push(this);
    expenseRowsEl.append(this.tr);
  }

  remove() {
    expenses.splice(expenses.length - 1);
    expenseRowsEl.removeChild(this.tr);
  }

  blink() {
    blink(this.tr);
  }
}

class EditAction {
  /**
   * @param {InputCell}  cell
   * @param {any}        oldVal
   * @param {any}        newVal
   */
  constructor(cell, oldVal, newVal) {
    this.id = makeActionId();
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

/** @type {(channel: string, data: any) => void} */
var sendToBackend;

/**
 * @typedef FileData
 * @property {object[]} expenses
 * @property {string}   expenses.name
 * @property {number}   expenses.amount
 * @property {number}   expenses.payPercent
 * @property {number}   expenses.paidPercent
 * @property {string}   expenses.usuallyDue
 * @property {boolean}  expenses.space
 * @property {object}   balances
 * @property {number}   balances.amount
 * @property {number}   balances.toPay
 * @property {number}   balances.due
 */
