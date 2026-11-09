const money = value => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value);
let cart = JSON.parse(localStorage.getItem('yg-cart') || '{}');
let activeCategory = 'All';
let checkoutStep = 1;
let checkoutPaymentMethods=[];
const $ = selector => document.querySelector(selector);
let products = [];
let signedInMember = null;
try {
  const cachedCustomer=JSON.parse(localStorage.getItem('yg-customer-display')||'null');
  if(cachedCustomer?.name){$('#accountTrigger').setAttribute('aria-label',`Customer profile for ${cachedCustomer.name}`);}
} catch (_) { localStorage.removeItem('yg-customer-display'); }

function saveCart() { localStorage.setItem('yg-cart',JSON.stringify(cart)); renderCart(); }
function escapeHtml(text){const node=document.createElement('div');node.textContent=text??'';return node.innerHTML;}
function selectedPaymentMethod(){const selected=$('#checkoutForm').elements.payment?.value;return checkoutPaymentMethods.find(method=>method.name===selected);}
function renderPaymentDetails(){const method=selectedPaymentMethod();if(!method){$('#paymentDetails').innerHTML='';$('#uploadZone').hidden=true;return;}$('#paymentDetails').innerHTML=`${method.qrUrl?`<img src="${method.qrUrl}" alt="${escapeHtml(method.name)} payment QR code">`:''}<div>${method.bankName?`<small>Bank / wallet</small><strong>${escapeHtml(method.bankName)}</strong>`:''}${method.accountName?`<small>Account name</small><strong>${escapeHtml(method.accountName)}</strong>`:''}${method.accountNumber?`<small>Account number</small><strong>${escapeHtml(method.accountNumber)}</strong>`:''}${method.instructions?`<p>${escapeHtml(method.instructions)}</p>`:''}</div>`;$('#uploadZone').hidden=!method.requiresReceipt;}
function renderPaymentMethods(){if(!checkoutPaymentMethods.length){$('#paymentOptions').innerHTML='<p>No payment methods are currently available. Please contact support.</p>';$('#checkoutNext').disabled=true;renderPaymentDetails();return;}$('#checkoutNext').disabled=false;$('#paymentOptions').innerHTML=checkoutPaymentMethods.map((method,index)=>`<label><input type="radio" name="payment" value="${escapeHtml(method.name)}" ${index===0?'checked':''}><span><b>${escapeHtml(method.name)}</b><small>${method.requiresReceipt?'Receipt required':'No receipt required'}</small></span></label>`).join('');document.querySelectorAll('[name="payment"]').forEach(input=>input.onchange=renderPaymentDetails);renderPaymentDetails();}
async function loadCheckoutPaymentMethods(){try{checkoutPaymentMethods=await YG_api('/api/payment-methods');renderPaymentMethods();}catch(error){$('#paymentOptions').innerHTML='<p>Payment methods could not be loaded.</p>';showToast(error.message);}}
function categories() { return ['All',...new Set(products.map(product => product.category))]; }
function renderCategories() {
  $('#categories').innerHTML = categories().map(category => `<button class="${category===activeCategory?'active':''}" data-category="${category}">${category}</button>`).join('');
  document.querySelectorAll('[data-category]').forEach(button => button.onclick=()=>{activeCategory=button.dataset.category;renderCategories();renderProducts();});
}
function renderProducts() {
  const max=Number($('#maxPrice').value), stockOnly=$('#inStock').checked, sort=$('#sort').value;
  let list=products.filter(product=>(activeCategory==='All'||product.category===activeCategory)&&product.price<=max&&(!stockOnly||product.stock>0));
  if(sort==='low') list.sort((a,b)=>a.price-b.price); if(sort==='high') list.sort((a,b)=>b.price-a.price);
  $('#resultCount').textContent=list.length;
  $('#productGrid').innerHTML=list.map(product=>`<article class="catalog-card"><div class="catalog-image ${product.tone}"><span class="stock-pill">${product.stock<=5?'Only '+product.stock+' left':'In stock'}</span>${product.imageUrl?`<img class="catalog-product-image" src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">`:`<div class="catalog-bottle">${escapeHtml(product.short)}</div>`}</div><div class="catalog-body"><p>${product.category}</p><h3>${product.name}</h3><p class="benefit">${product.benefit}</p><div class="price-row"><strong>${money(product.price)}</strong><button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag">+</button></div></div></article>`).join('')||'<p>No products match these filters.</p>';
  document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{cart[button.dataset.add]=(cart[button.dataset.add]||0)+1;saveCart();showToast('Added to your bag');});
}
function renderCart() {
  let count=0,total=0;
  const rows=Object.entries(cart).map(([id,quantity])=>{const product=products.find(item=>item.id===id);if(!product)return '';count+=quantity;total+=product.price*quantity;return `<div class="cart-line"><div class="cart-thumb">${product.short}</div><div><h4>${product.name}</h4><p>${money(product.price)}</p><div class="qty-controls"><button data-dec="${id}">−</button><span>${quantity}</span><button data-inc="${id}">+</button></div></div><button class="remove-item" data-remove="${id}">×</button></div>`;}).join('');
  $('#cartCount').textContent=count; $('#cartCount').classList.toggle('hidden',count===0); $('#cartSubtotal').textContent=money(total); $('#cartItems').innerHTML=rows||'<div class="empty-cart"><p class="script">Your ritual awaits</p><p>Your bag is currently empty.</p></div>';
  document.querySelectorAll('[data-inc]').forEach(button=>button.onclick=()=>{cart[button.dataset.inc]++;saveCart();});
  document.querySelectorAll('[data-dec]').forEach(button=>button.onclick=()=>{if(--cart[button.dataset.dec]<=0)delete cart[button.dataset.dec];saveCart();});
  document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{delete cart[button.dataset.remove];saveCart();});
}
function toggleCart(open) { $('#cartDrawer').classList.toggle('open',open); $('#drawerBackdrop').classList.toggle('open',open); }
function showToast(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); setTimeout(()=>$('#toast').classList.remove('show'),2500); }
function validateCheckoutStep(step){const invalid=$(`.checkout-step[data-step="${step}"]`).querySelector(':invalid');if(!invalid)return true;invalid.reportValidity();return false;}
function showStep(step) {
  checkoutStep=step;
  document.querySelectorAll('.checkout-step').forEach((element,index)=>element.classList.toggle('active',index===step-1));
  document.querySelectorAll('.checkout-progress span').forEach((element,index)=>element.classList.toggle('active',index<=step-1));
  $('#checkoutBack').style.visibility=step===1?'hidden':'visible';
  $('#checkoutNext').innerHTML=step===3?'Place order <span>→</span>':'Continue <span>→</span>';
  if(step===3){const total=Object.entries(cart).reduce((sum,[id,quantity])=>sum+products.find(product=>product.id===id).price*quantity,0);$('#orderReview').innerHTML=Object.entries(cart).map(([id,quantity])=>{const product=products.find(item=>item.id===id);return `<div class="review-row"><span>${quantity} × ${product.name}</span><b>${money(product.price*quantity)}</b></div>`;}).join('')+`<div class="review-row"><span>Estimated shipping</span><b>${money(150)}</b></div><div class="review-row"><strong>Total</strong><strong>${money(total+150)}</strong></div>`;}
}

$('#maxPrice').oninput=event=>{$('#priceLabel').textContent=money(event.target.value);renderProducts();}; $('#inStock').onchange=renderProducts; $('#sort').onchange=renderProducts;
$('#shopMenuButton').onclick=()=>{const open=document.querySelector('.store-site-header').classList.toggle('open');$('#shopMenuButton').setAttribute('aria-expanded',String(open));};
document.querySelectorAll('.store-site-header nav a').forEach(link=>link.onclick=()=>document.querySelector('.store-site-header').classList.remove('open'));
$('#cartTrigger').onclick=()=>toggleCart(true); $('#closeCart').onclick=()=>toggleCart(false); $('#drawerBackdrop').onclick=()=>toggleCart(false);
$('#checkoutButton').onclick=()=>{if(!Object.keys(cart).length)return showToast('Your bag is empty');toggleCart(false);if(signedInMember){const form=$('#checkoutForm');form.elements.name.value=signedInMember.name||'';form.elements.phone.value=signedInMember.phone||'';form.elements.email.value=signedInMember.email||'';form.elements.address.value=signedInMember.address||'';$('#checkoutAccountNote').innerHTML=`<div><b>Signed in as ${signedInMember.name}</b><small>This order will be added to your wellness profile.</small></div><a href="/account">View profile</a>`;$('#guestSave').style.display='none';}$('#checkoutModal').classList.add('open');showStep(1);};
$('#closeCheckout').onclick=()=>$('#checkoutModal').classList.remove('open'); $('#checkoutBack').onclick=()=>showStep(checkoutStep-1);
$('#checkoutNext').onclick=async()=>{
  if(checkoutStep<3){
    if(checkoutStep===1&&!validateCheckoutStep(1))return;
    if(checkoutStep===2){
      const payment=$('#checkoutForm').elements.payment.value;
      if(selectedPaymentMethod()?.requiresReceipt&&!$('#receipt').files[0]){
        $('#uploadZone').classList.add('needs-receipt');
        showToast(`Please upload proof of payment for ${payment}.`);
        return;
      }
    }
    showStep(checkoutStep+1);return;
  }
  if(!$('#checkoutForm').reportValidity())return;
  const formData=new FormData($('#checkoutForm'));
  const items=Object.entries(cart).map(([id,quantity])=>{const product=products.find(item=>item.id===id);return {id,name:product.name,quantity,price:product.price};});
  const payload={customer:formData.get('name'),email:formData.get('email'),phone:formData.get('phone'),address:formData.get('address'),region:formData.get('region'),postal:formData.get('postal'),payment:formData.get('payment'),items};
  $('#checkoutNext').disabled=true; $('#checkoutNext').textContent='Saving…';
  try {
    const saved=await window.YG_createOrder(payload,$('#receipt').files[0]);
    const order={number:saved.number,customer:payload.customer,total:saved.total,payment:payload.payment,status:saved.status,date:saved.date};
    cart={};saveCart();$('#checkoutModal').classList.remove('open');showToast(`Order ${order.number} saved successfully`);
  } catch(error) { showToast(error.message||'Could not save the order. Please try again.'); }
  finally { $('#checkoutNext').disabled=false; $('#checkoutNext').innerHTML='Place order <span>→</span>'; }
};
$('#receipt').onchange=event=>{const file=event.target.files[0];if(!file)return;$('#receiptPreview').src=URL.createObjectURL(file);$('#uploadZone').classList.remove('needs-receipt');$('#uploadZone').classList.add('has-preview');};
async function initializeStore(){
  try{
    products=(await YG_api('/api/products')).filter(product=>product.isActive!==false);
    Object.keys(cart).forEach(id=>{if(!products.some(product=>product.id===id))delete cart[id];});
    localStorage.setItem('yg-cart',JSON.stringify(cart));
    renderCategories();renderProducts();renderCart();
  }catch(error){
    $('#productGrid').innerHTML='<p>Products could not be loaded. Please refresh the page.</p>';
    showToast(error.message);
  }
}
initializeStore();
loadCheckoutPaymentMethods();
YG_api('/api/auth/me').then(user=>{if(user.role==='client'){signedInMember=user;localStorage.setItem('yg-customer-display',JSON.stringify({name:user.name}));$('#accountTrigger').setAttribute('aria-label',`Customer profile for ${user.name}`);}}).catch(()=>{localStorage.removeItem('yg-customer-display');$('#accountTrigger').setAttribute('aria-label','Customer profile');});
