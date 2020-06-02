const totalRowEl = /**@type {HTMLTableRowElement}*/(document.getElementById('totalRow'));
const balanceRowEl = /**@type {HTMLTableRowElement}*/(document.getElementById('balanceRow'));
const remainderRowEl = /**@type {HTMLTableRowElement}*/(document.getElementById('remainderRow'));
const expenseRowsEl = /**@type {HTMLTableSectionElement}*/(document.getElementById('expenseRows'));
const welcomeEl = /**@type {HTMLElement}*/(document.getElementById('welcome'));

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
    this.effects?.refresh();
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

    this.input.readOnly = true;
    this.input.value = format(this.value);



    this.input.onfocus = () => {
      // if (this.input.readOnly) {
      //   this.input.blur();
      // }
      this.budget.setCurrentCell(this);
    };

    // this.input.onkeypress = (e) => {
    //   console.log('ok');
    //   if (this.input.readOnly) {
    //     if (e.keyCode === 13) {
    //       this.input.readOnly = false;
    //       this.input.focus();
    //     }
    //   }
    // };

    this.input.onclick = () => {
      this.budget.setCurrentCell(this);
    };

    this.input.onblur = () => {
      // this.input.readOnly = true;
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
    this.effects?.refresh();
  }
}

class Item {

  /**
  * @param {Budget} budget
  */
  constructor(budget) {
    this.budget = budget;
    this.tr = document.createElement('tr');

    const dragCell = newCell('td', '⸬');
    dragCell.classList.add('draghandle');
    this.tr.append(dragCell);
    this.setupDrag(dragCell);

    this.tr.oncontextmenu = (e) => {
      e.preventDefault();
      sendToBackend('showMenu', e.clientX, e.clientY, budget.items.indexOf(this));
    };
  }

  // private
  setupDrag(/** @type {HTMLElement} */ dragHandle) {
    dragHandle.draggable = true;
    dragHandle.ondragstart = (e) => {
      this.budget.dragging = this;
      this.budget.dragging.tr.classList.add('dragging');
    };

    dragHandle.ondragend = () => {
      this.budget.dragging?.tr.classList.remove('dragging');
      this.budget.dragging = null;

      this.budget.dropping?.tr.classList.remove('dropping');
      this.budget.dropping = null;
    };

    this.tr.ondragover = (e) => {
      if (this.budget.dragging && this.budget.dragging !== this) {
        this.budget.dropping?.tr.classList.remove('dropping');
        this.budget.dropping = this;
        this.budget.dropping.tr.classList.add('dropping');

        e.preventDefault();
      }
    };

    this.tr.ondrop = (e) => {
      this.budget.undoStack.doAction(new MoveItemAction(
        this.budget.items.indexOf(this.budget.dragging),
        this.budget.items.indexOf(this.budget.dropping)
      ));
    };
  }

  // wish TypeScript / JSDoc had a way to say "must be overridden"
  serialize() {
    throw new Error("Method not implemented.");
  }

  add(/** @type {number=} */ index) {
    if (index === undefined) index = this.budget.items.length;
    this.budget.items.splice(index, 0, this);
    expenseRowsEl.insertBefore(this.tr, expenseRowsEl.children[index]);
  }

  remove() {
    this.budget.items.splice(this.budget.items.indexOf(this), 1);
    expenseRowsEl.removeChild(this.tr);
  }

  blink() {
    blink(this.tr);
  }
}

class Expense extends Item {
  /**
   * @param {Budget}       budget
   * @param {ExpenseData=} data
   */
  constructor(budget, data) {
    super(budget);

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

class Space extends Item {
  /**
   * @param {Budget} budget
   */
  constructor(budget) {
    super(budget);

    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
    this.tr.append(newCell('td', ''));
  }

  serialize() {
    return { space: true };
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

    this.budget.updated();
  }

  redo() {
    if (this.nextAction === this.actions.length) return;
    const action = this.actions[this.nextAction++];
    action.redo();

    this.budget.updated();
  }

  doAction(/** @type {Action} */ action) {
    if (this.nextAction < this.actions.length) {
      this.actions.splice(this.nextAction);
    }

    this.actions.push(action);
    this.redo();

    this.budget.updated();
  }
}

class Totals {

  /**
   * @param {Budget}       budget
   * @param {BalanceData=} data
   */
  constructor(budget, data) {
    this.totalAmountCell = new CalculatedCell({
      get: () => budget.items.reduce((a, b) => (b instanceof Expense
        ? a + b.amountCell.value
        : a), 0),
      dependsOn: [],
    });

    this.totalToPayCell = new CalculatedCell({
      get: () => budget.items.reduce((a, b) => (b instanceof Expense
        ? a + b.toPayCell.value
        : a), 0),
      dependsOn: [],
    });

    this.totalDueCell = new CalculatedCell({
      get: () => budget.items.reduce((a, b) => (b instanceof Expense
        ? a + b.dueCell.value
        : a), 0),
      dependsOn: [],
    });

    totalRowEl.append(newCell('td', ''));
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

    balanceRowEl.append(newCell('td', ''));
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

    remainderRowEl.append(newCell('td', ''));
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
    this.dragging = /** @type {Item} */(null);
    this.dropping = /** @type {Item} */(null);

    /** @type {InputCell} */
    this.currentCell = null;

    this.undoStack = new UndoStack(this);
    this.items = /** @type {Item[]} */([]);
    this.totals = new Totals(this, data?.balances);

    for (const expenseData of data?.expenses || []) {
      if (expenseData.space) {
        new Space(this).add();
      }
      else {
        new Expense(this, expenseData).add();
      }
    }

    this.updated();

    this.keyHandler = this.handleKeys.bind(this);

    window.addEventListener('keydown', this.keyHandler);
  }

  updated() {
    this.updateBackendData();
    this.totals.refresh();
  }

  handleKeys(/** @type {KeyboardEvent} */ e) {
    if (e.ctrlKey && !e.altKey && e.key === 'z') { e.preventDefault(); this.undoStack.undo(); return; }
    if (e.ctrlKey && !e.altKey && e.key === 'y') { e.preventDefault(); this.undoStack.redo(); return; }
  }

  setCurrentCell(/** @type {InputCell} */ cell) {
    this.currentCell?.td.classList.remove('focused');

    this.currentCell = cell;
    this.currentCell.td.classList.add('focused');
  }

  updateBackendData() {
    sendToBackend('isClean', this.undoStack.isClean());
    sendToBackend('changedData', {
      expenses: this.items.map(e => e.serialize()),
      balances: this.totals.serialize(),
    });
  }

  deleteItem(/** @type {number} */index) {
    this.undoStack.doAction(new RemoveItemAction(this.items[index], index));
  }

  dispose() {
    window.removeEventListener('keydown', this.keyHandler);
    this.totals.dispose();
    for (const expense of [...this.items]) {
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

function newCell(/** @type {string} */ type, /** @type {string} */ text) {
  const el = document.createElement(type);
  el.className = 'cell';
  el.innerText = text;
  return el;
}

window.addEventListener('keydown', (e) => {
  if (!e.ctrlKey && !e.altKey && e.key === 'F5') { e.preventDefault(); sendToBackend('reload'); return; }
  if (!e.ctrlKey && !e.altKey && e.key === 'F12') { e.preventDefault(); sendToBackend('toggleDevTools'); return; }
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
    this.item.tr.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
    this.item.tr.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    this.item.blink();
  }

  redo() {
    this.item.remove();
  }
}

class MoveItemAction {
  /**
   * @param {number} from
   * @param {number} to
   */
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  undo() {
    const item = currentBudget.items[this.to];
    currentBudget.items[this.to].remove();
    item.add(this.from);
    item.tr.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    item.blink();
  }

  redo() {
    const item = currentBudget.items[this.from];
    currentBudget.items[this.from].remove();
    item.add(this.to);
    item.tr.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    item.blink();
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
    this.cell.input.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  redo() {
    this.cell.useValue(this.newVal);
    this.cell.input.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
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
 * @property {string}  name
 * @property {number}  amount
 * @property {number}  payPercent
 * @property {number}  paidPercent
 * @property {string}  usuallyDue
 * @property {boolean} space
 */

/**
 * @typedef BalanceData
 * @property {number}  amount
 * @property {number}  toPay
 * @property {number}  due
 */

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
 * @property {ExpenseData[]} expenses
 * @property {BalanceData}   balances
 */

/**
 * @typedef Action
 * @property {() => void} undo
 * @property {() => void} redo
 */

/** @type {(channel: string, ...data: any) => void} */
var sendToBackend;
