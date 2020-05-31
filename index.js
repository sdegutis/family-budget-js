const totalRowEl = /**@type HTMLTableRowElement*/(document.getElementById('totalRow'));
const balanceRowEl = /**@type HTMLTableRowElement*/(document.getElementById('balanceRow'));
const remainderRowEl = /**@type HTMLTableRowElement*/(document.getElementById('remainderRow'));
const expenseRowsEl = /**@type HTMLTableSectionElement*/(document.getElementById('expenseRows'));

class CalculatedCell {
  /**
   * @param {object}               opts
   * @param {() => any}            opts.get
   * @param {Dependencies[]}       opts.dependsOn
   */
  constructor({ get, dependsOn }) {
    for (const dep of dependsOn) {
      dep.effects = this;
    }

    /** @type {Effected} */
    this.effects = null;

    this.get = get;

    this.td = document.createElement('td');
    this.td.classList.add('cell');
    this.refresh();
  }

  refresh() {
    this.value = this.get();
    this.td.innerText = formatMoney(this.value);

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
   * @param {Budget}               opts.budget
   */
  constructor({ initial, format, parse, budget }) {
    this.budget = budget;

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
          budget.undoStack.doAction(new EditAction(this, this.value, newVal));
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
  /**
   * @param {Budget}       budget
   * @param {FileData['expenses'][0]=} data
   */
  constructor(budget, data) {
    this.budget = budget;

    this.tr = document.createElement('tr');
    expenseRowsEl.append(this.tr);

    // setTimeout(() => {
    this.tr.setAttribute('draggable', 'true');
    this.tr.ondragstart = (e) => {
      e.preventDefault();
      console.log('dragging');
      // e.dataTransfer.setData('row', budget.expenses.indexOf(this).toString());
    };

    // this.tr.ondragover = (e) => {
    //   // if (e.dataTransfer.getData('row')) {
    //   e.preventDefault();
    //   console.log('over');
    //   // console.log(e.dataTransfer.getData('row'));
    //   // }
    // };
    // }, 100);

    this.tr.oncontextmenu = (e) => {
      e.preventDefault();
      sendToBackend('showMenu', e.clientX, e.clientY, budget.expenses.indexOf(this));
    };

    this.nameCell = new InputCell({
      budget,
      initial: data?.name ?? 'New Expense',
      format: s => s,
      parse: s => s,
    });

    this.amountCell = new InputCell({
      budget,
      initial: data?.amount ?? 0,
      format: formatMoney,
      parse: parseMoney,
    });

    this.payPercentCell = new InputCell({
      budget,
      initial: data?.payPercent ?? 1,
      format: formatPercent,
      parse: parsePercent,
    });

    this.toPayCell = new CalculatedCell({
      get: () => this.amountCell.value * this.payPercentCell.value,
      dependsOn: [this.amountCell, this.payPercentCell],
    });

    this.paidPercentCell = new InputCell({
      budget,
      initial: data?.paidPercent ?? 0,
      format: formatPercent,
      parse: parsePercent,
    });

    this.dueCell = new CalculatedCell({
      get: () => this.toPayCell.value - (this.toPayCell.value * this.paidPercentCell.value),
      dependsOn: [this.toPayCell, this.paidPercentCell],
    });

    this.usuallyDueCell = new InputCell({
      budget,
      initial: data?.usuallyDue ?? '',
      format: s => s,
      parse: s => s,
    });

    this.actuallyDueCell = new CalculatedCell({
      get: () => this.dueCell.value === 0 ? '-' : this.usuallyDueCell.value,
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

  add(/** @type {number=} */ index) {
    if (index === undefined) index = this.budget.expenses.length;
    this.budget.expenses.splice(index, 0, this);
    expenseRowsEl.insertBefore(this.tr, expenseRowsEl.children[index]);
  }

  remove() {
    this.budget.expenses.splice(this.budget.expenses.indexOf(this), 1);
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

class Space {
  /**
   * @param {Budget} budget
   */
  constructor(budget) {
    this.budget = budget;

    this.tr = document.createElement('tr');

    this.tr.oncontextmenu = (e) => {
      e.preventDefault();
      sendToBackend('showMenu', e.clientX, e.clientY, budget.expenses.indexOf(this));
    };

    const td = document.createElement('td');
    td.innerHTML = '&nbsp;';
    td.colSpan = 8;
    td.className = 'empty cell';

    this.tr.append(td);
  }

  serialize() {
    return { space: true };
  }

  add(/** @type {number=} */ index) {
    if (index === undefined) index = this.budget.expenses.length;
    this.budget.expenses.splice(index, 0, this);
    expenseRowsEl.insertBefore(this.tr, expenseRowsEl.children[index]);
  }

  remove() {
    this.budget.expenses.splice(this.budget.expenses.indexOf(this), 1);
    expenseRowsEl.removeChild(this.tr);
  }

  blink() {
    blink(this.tr);
  }
}

class UndoStack {

  /**
   * @param {Budget} budget
   */
  constructor(budget) {
    this.budget = budget;
    this.actions = /** @type {Action[]} */([]);
    this.nextAction = 0;
    this.cleanAction = /** @type {Action} */(null);
  }

  isClean() {
    if (this.nextAction === 0) return this.cleanAction === null;
    return this.actions[this.nextAction - 1] === this.cleanAction;
  }

  noteCleanAction() {
    if (this.nextAction === 0) {
      this.cleanAction = null;
    }
    else {
      this.cleanAction = this.actions[this.nextAction - 1];
    }
  }

  undo() {
    if (this.nextAction === 0) return;
    const action = this.actions[--this.nextAction];
    action.undo();

    this.budget.updateBackendData();
    this.budget.totals.refresh();
  }

  redo() {
    if (this.nextAction === this.actions.length) return;
    const action = this.actions[this.nextAction++];
    action.redo();

    this.budget.updateBackendData();
    this.budget.totals.refresh();
  }

  doAction(/** @type {Action} */ action) {
    if (this.nextAction < this.actions.length) {
      this.actions.splice(this.nextAction);
    }

    this.actions.push(action);
    this.redo();

    this.budget.updateBackendData();
    this.budget.totals.refresh();
  }
}

class Totals {

  /**
   * @param {Budget}                budget
   * @param {FileData['balances']=} data
   */
  constructor(budget, data) {
    const newCell = (/** @type {string} */ type, /** @type {string} */ text) => {
      const el = document.createElement(type);
      el.className = 'cell';
      el.innerText = text;
      return el;
    };

    this.totalAmountCell = new CalculatedCell({
      get: () => budget.expenses.reduce((a, b) => (b instanceof Expense
        ? a + b.amountCell.value
        : a), 0),
      dependsOn: [],
    });

    this.totalToPayCell = new CalculatedCell({
      get: () => budget.expenses.reduce((a, b) => (b instanceof Expense
        ? a + b.toPayCell.value
        : a), 0),
      dependsOn: [],
    });

    this.totalDueCell = new CalculatedCell({
      get: () => budget.expenses.reduce((a, b) => (b instanceof Expense
        ? a + b.dueCell.value
        : a), 0),
      dependsOn: [],
    });

    totalRowEl.append(newCell('th', 'Total'));
    totalRowEl.append(this.totalAmountCell.td);
    totalRowEl.append(newCell('td', ''));
    totalRowEl.append(this.totalToPayCell.td);
    totalRowEl.append(newCell('td', ''));
    totalRowEl.append(this.totalDueCell.td);
    totalRowEl.append(newCell('td', ''));
    totalRowEl.append(newCell('td', ''));

    this.balanceAmountCell = new InputCell({
      budget,
      initial: data?.amount ?? 0,
      format: formatMoney,
      parse: parseMoney,
    });

    this.balanceToPayCell = new InputCell({
      budget,
      initial: data?.toPay ?? 0,
      format: formatMoney,
      parse: parseMoney,
    });

    this.balanceDueCell = new InputCell({
      budget,
      initial: data?.due ?? 0,
      format: formatMoney,
      parse: parseMoney,
    });

    balanceRowEl.append(newCell('th', 'Balance'));
    balanceRowEl.append(this.balanceAmountCell.td);
    balanceRowEl.append(newCell('td', ''));
    balanceRowEl.append(this.balanceToPayCell.td);
    balanceRowEl.append(newCell('td', ''));
    balanceRowEl.append(this.balanceDueCell.td);
    balanceRowEl.append(newCell('td', ''));
    balanceRowEl.append(newCell('td', ''));

    this.remainderAmountCell = new CalculatedCell({
      get: () => this.balanceAmountCell.value - this.totalAmountCell.value,
      dependsOn: [this.totalAmountCell, this.balanceAmountCell],
    });

    this.remainderToPayCell = new CalculatedCell({
      get: () => this.balanceToPayCell.value - this.totalToPayCell.value,
      dependsOn: [this.totalToPayCell, this.balanceToPayCell],
    });

    this.remainderDueCell = new CalculatedCell({
      get: () => this.balanceDueCell.value - this.totalDueCell.value,
      dependsOn: [this.totalDueCell, this.balanceDueCell],
    });

    remainderRowEl.append(newCell('th', 'Remainder'));
    remainderRowEl.append(this.remainderAmountCell.td);
    remainderRowEl.append(newCell('td', ''));
    remainderRowEl.append(this.remainderToPayCell.td);
    remainderRowEl.append(newCell('td', ''));
    remainderRowEl.append(this.remainderDueCell.td);
    remainderRowEl.append(newCell('td', ''));
    remainderRowEl.append(newCell('td', ''));
  }

  refresh() {
    this.totalAmountCell.refresh();
    this.totalToPayCell.refresh();
    this.totalDueCell.refresh();

    this.remainderAmountCell.refresh();
    this.remainderToPayCell.refresh();
    this.remainderDueCell.refresh();
  }

  serialize() {
    return {
      amount: this.balanceAmountCell.value,
      toPay: this.balanceToPayCell.value,
      due: this.balanceDueCell.value,
    };
  }

  dispose() {
    totalRowEl.innerHTML = '';
    balanceRowEl.innerHTML = '';
    remainderRowEl.innerHTML = '';
  }
}

class Budget {

  /**
   * @param {FileData=} data
   */
  constructor(data) {
    this.undoStack = new UndoStack(this);
    this.expenses = /** @type {Item[]} */([]);
    this.totals = new Totals(this, data?.balances);

    for (const expenseData of data?.expenses || []) {
      if (expenseData.space) {
        new Space(this).add();
      }
      else {
        new Expense(this, expenseData).add();
      }
    }

    this.updateBackendData();
    this.totals.refresh();
  }

  updateBackendData() {
    sendToBackend('isClean', this.undoStack.isClean());
    sendToBackend('changedData', {
      expenses: this.expenses.map(e => e.serialize()),
      balances: this.totals.serialize(),
    });
  }

  deleteItem(/** @type {number} */index) {
    this.undoStack.doAction(new RemoveItemAction(this.expenses[index], index));
  }

  dispose() {
    this.totals.dispose();
    for (const expense of [...this.expenses]) {
      expense.remove();
    }
  }
}

let currentBudget = new Budget();

function openFile(/** @type {FileData} */json) {
  currentBudget.dispose();
  currentBudget = new Budget(json);
}

function newFile() {
  currentBudget.dispose();
  currentBudget = new Budget();
}

function savedFile() {
  currentBudget.undoStack.noteCleanAction();
  currentBudget.updateBackendData();
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
  currentBudget.undoStack.doAction(new AddItemAction(new Expense(currentBudget)));
}

function addSpace() {
  currentBudget.undoStack.doAction(new AddItemAction(new Space(currentBudget)));
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && !e.altKey && e.key === 'z') { e.preventDefault(); currentBudget.undoStack.undo(); }
  if (e.ctrlKey && !e.altKey && e.key === 'y') { e.preventDefault(); currentBudget.undoStack.redo(); }
  if (!e.ctrlKey && !e.altKey && e.key === 'F5') { e.preventDefault(); sendToBackend('reload'); }
  if (!e.ctrlKey && !e.altKey && e.key === 'F12') { e.preventDefault(); sendToBackend('toggleDevTools'); }
});

class AddItemAction {
  /**
   * @param {Item} item
   */
  constructor(item) {
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

class RemoveItemAction {
  /**
   * @param {Item}   item
   * @param {number} index
   */
  constructor(item, index) {
    this.item = item;
    this.index = index;
  }

  undo() {
    this.item.add(this.index);
    this.item.blink();
  }

  redo() {
    this.item.remove();
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
 * @typedef Effected
 * @property {() => void} refresh
 */

/**
 * @typedef Dependencies
 * @property {Effected} effects
 */

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

/**
 * @typedef Action
 * @property {() => void} undo
 * @property {() => void} redo
 */

/**
 * @typedef Item
 * @property {(n?: number) => void} add
 * @property {() => void} remove
 * @property {() => void} blink
 * @property {() => any}  serialize
 */

/** @type {(channel: string, ...data: any) => void} */
var sendToBackend;
