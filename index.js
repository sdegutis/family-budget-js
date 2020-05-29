const balanceAmountEl = /**@type HTMLInputElement*/(document.getElementById('balanceAmount'));
const balanceToPayEl = /**@type HTMLInputElement*/(document.getElementById('balanceToPay'));
const balanceDueEl = /**@type HTMLInputElement*/(document.getElementById('balanceDue'));

const expenseRowsEl = /**@type HTMLTableSectionElement*/(document.getElementById('expenseRows'));

class Expense {
  constructor(/** @type {ExpenseData=} */ data) {
    this.name = data?.name ?? 'Unnamed bill';
    this.amount = data?.amount ?? 0;
    this.payPercent = data?.payPercent ?? 1;
    this.paidPercent = data?.paidPercent ?? 0;
    this.usuallyDue = data?.usuallyDue ?? '';

    this.tr = document.createElement('tr');
    expenseRowsEl.append(this.tr);
  }

  toPay() {
    return this.amount * this.payPercent;
  }

  due() {
    return this.toPay() - (this.toPay() * this.paidPercent);
  }

  actuallyDue() {
    return this.due() === 0 ? '-' : this.usuallyDue;
  }

  serialize() {
    return {
      name: this.name,
      amount: this.amount,
      payPercent: this.payPercent,
      paidPercent: this.paidPercent,
      usuallyDue: this.usuallyDue,
    };
  }
}

const newLocal = new Expense();
newLocal.toPay

/** @type {Expense[]} */
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
      doAction(new ChangeBalanceAction(el, key, parseMoney(el.value)));
      el.blur();
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
  return parseFloat(amount.replace(/\$/g, ''));
}

function addExpense() {
  expenses.push(new Expense());
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
});

function undo() {
  console.log('running undo');
  if (nextAction === 0) return;
  const action = actions[--nextAction];
  action.undo();
}

function redo() {
  console.log('running redo');
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
  }

  redo() {
    balances[this.key] = this.newVal;
    this.el.value = formatMoney(balances[this.key]);
  }
}

/**
 * @typedef ExpenseData
 * @property {string} name
 * @property {number} amount
 * @property {number} payPercent
 * @property {number} paidPercent
 * @property {string} usuallyDue
 */