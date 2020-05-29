const balanceAmountEl = /**@type HTMLInputElement*/(document.getElementById('balanceAmount'));
const balanceToPayEl = /**@type HTMLInputElement*/(document.getElementById('balanceToPay'));
const balanceDueEl = /**@type HTMLInputElement*/(document.getElementById('balanceDue'));

const balances = {
  amount: 10,
  toPay: 20,
  due: 30,
};

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
      balances[key] = parseMoney(el.value);
      el.value = formatMoney(balances[key]);
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
