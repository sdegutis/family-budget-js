const balanceAmountEl = /**@type HTMLInputElement*/(document.getElementById('balanceAmount'));
const balanceToPayEl = /**@type HTMLInputElement*/(document.getElementById('balanceToPay'));
const balanceDueEl = /**@type HTMLInputElement*/(document.getElementById('balanceDue'));

const balances = {
  amount: 0,
  toPay: 0,
  due: 0,
};

balanceAmountEl.onkeydown = changeBalance(balanceAmountEl, 'amount');
balanceToPayEl.onkeydown = changeBalance(balanceToPayEl, 'toPay');
balanceDueEl.onkeydown = changeBalance(balanceDueEl, 'due');

/**
 * @param {HTMLInputElement} el
 * @param {keyof balances} key
 */
function changeBalance(el, key) {
  /** @type {(this: GlobalEventHandlers, ev: KeyboardEvent) => any} */
  return function handler(e) {
    if (e.keyCode === 13) {

    }
    else if (e.keyCode === 27) {

    }
  };
}
