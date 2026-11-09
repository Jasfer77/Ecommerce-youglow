const money = value => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value);
let cart = JSON.parse(localStorage.getItem('yg-cart') || '{}');
let checkoutStep = 1;
let checkoutPaymentMethods=[];
const $ = selector => document.querySelector(selector);
let products = [];
let signedInMember = null;
try {
  const cachedCustomer=JSON.parse(localStorage.getItem('yg-customer-display')||'null');
  if(cachedCustomer?.name){$('#accountTrigger').setAttribute('aria-label',`Customer profile for ${cachedCustomer.name}`);}
} catch (_) { localStorage.removeItem('yg-customer-display'); }

function saveCart() { localStorage.setItem('yg-cart',JSON.stringify(cart)); renderCart();if(window.parent!==window)window.parent.postMessage({type:'yg-cart-updated'},location.origin); }
function escapeHtml(text){const node=document.createElement('div');node.textContent=text??'';return node.innerHTML;}
function selectedPaymentMethod(){const selected=$('#checkoutForm').elements.payment?.value;return checkoutPaymentMethods.find(method=>method.name===selected);}
function renderPaymentDetails(){const method=selectedPaymentMethod();if(!method){$('#paymentDetails').innerHTML='';$('#uploadZone').hidden=true;return;}$('#paymentDetails').innerHTML=`${method.qrUrl?`<img src="${method.qrUrl}" alt="${escapeHtml(method.name)} payment QR code">`:''}<div>${method.bankName?`<small>Bank / wallet</small><strong>${escapeHtml(method.bankName)}</strong>`:''}${method.accountName?`<small>Account name</small><strong>${escapeHtml(method.accountName)}</strong>`:''}${method.accountNumber?`<small>Account number</small><strong>${escapeHtml(method.accountNumber)}</strong>`:''}${method.instructions?`<p>${escapeHtml(method.instructions)}</p>`:''}</div>`;$('#uploadZone').hidden=!method.requiresReceipt;}
function renderPaymentMethods(){if(!checkoutPaymentMethods.length){$('#paymentOptions').innerHTML='<p>No payment methods are currently available. Please contact support.</p>';$('#checkoutNext').disabled=true;renderPaymentDetails();return;}$('#checkoutNext').disabled=false;$('#paymentOptions').innerHTML=checkoutPaymentMethods.map((method,index)=>`<label><input type="radio" name="payment" value="${escapeHtml(method.name)}" ${index===0?'checked':''}><span><b>${escapeHtml(method.name)}</b><small>${method.requiresReceipt?'Receipt required':'No receipt required'}</small></span></label>`).join('');document.querySelectorAll('[name="payment"]').forEach(input=>input.onchange=renderPaymentDetails);renderPaymentDetails();}
async function loadCheckoutPaymentMethods(){try{checkoutPaymentMethods=await YG_api('/api/payment-methods');renderPaymentMethods();}catch(error){$('#paymentOptions').innerHTML='<p>Payment methods could not be loaded.</p>';showToast(error.message);}}
function collectionArtwork(product){
  if(product.imageUrl)return product.imageUrl;
  const label=`${product.name||''} ${product.short||''}`.toLowerCase();
  if(label.includes('tirzepatide')||label.includes('trzz'))return label.includes('30')?'assets/landing/tirzepatide-30mg.jpg':'assets/landing/tirzepatide-15mg.jpg';
  if(label.includes('ghk'))return 'assets/landing/ghk-cu-50mg.jpg';
  if(label.includes('nad'))return 'assets/landing/nad-50mg.jpg';
  return '';
}
function renderProducts() {
  const sort=$('#sort').value;
  let list=[...products];
  if(sort==='low') list.sort((a,b)=>a.price-b.price); if(sort==='high') list.sort((a,b)=>b.price-a.price);
  $('#resultCount').textContent=list.length;
  $('#productGrid').innerHTML=list.map(product=>{const artwork=collectionArtwork(product);return `<article class="catalog-card"><div class="catalog-image ${product.tone}"><span class="stock-pill">${product.stock<=5?'Only '+product.stock+' left':'In stock'}</span>${artwork?`<img class="catalog-product-image" src="${escapeHtml(artwork)}" alt="${escapeHtml(product.name)}">`:`<div class="catalog-bottle">${escapeHtml(product.short)}</div>`}</div><div class="catalog-body"><p>${product.category}</p><h3>${product.name}</h3><p class="benefit">${product.benefit}</p><div class="price-row"><strong>${money(product.price)}</strong><button class="add-button" data-add="${product.id}" aria-label="Add ${product.name} to bag">+</button></div></div></article>`;}).join('')||'<p>No products are currently available.</p>';
  document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{cart[button.dataset.add]=(cart[button.dataset.add]||0)+1;saveCart();showToast('Added to your bag');});
}
function renderCart() {
  let count=0,total=0;
  const rows=Object.entries(cart).map(([id,quantity])=>{const product=products.find(item=>item.id===id);if(!product)return '';count+=quantity;total+=product.price*quantity;const artwork=collectionArtwork(product);return `<div class="cart-line"><div class="cart-thumb">${artwork?`<img src="${escapeHtml(artwork)}" alt="">`:escapeHtml(product.short)}</div><div><h4>${product.name}</h4><p>${money(product.price)}</p><div class="qty-controls"><button data-dec="${id}">−</button><span>${quantity}</span><button data-inc="${id}">+</button></div></div><button class="remove-item" data-remove="${id}">×</button></div>`;}).join('');
  $('#cartCount').textContent=count; $('#cartCount').hidden=count===0; $('#cartCount').classList.toggle('hidden',count===0); $('#cartSubtotal').textContent=money(total); $('#cartItems').innerHTML=rows||'<div class="empty-cart"><p class="script">Your ritual awaits</p><p>Your bag is currently empty.</p></div>';
  document.querySelectorAll('[data-inc]').forEach(button=>button.onclick=()=>{cart[button.dataset.inc]++;saveCart();});
  document.querySelectorAll('[data-dec]').forEach(button=>button.onclick=()=>{if(--cart[button.dataset.dec]<=0)delete cart[button.dataset.dec];saveCart();});
  document.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{delete cart[button.dataset.remove];saveCart();});
}
function toggleCart(open) { $('#cartDrawer').classList.toggle('open',open); $('#drawerBackdrop').classList.toggle('open',open); }
function showToast(message) { $('#toast').textContent=message; $('#toast').classList.add('show'); setTimeout(()=>$('#toast').classList.remove('show'),2500); }
window.addEventListener('message',async event=>{if(event.origin!==location.origin||event.data?.type!=='yg-open-checkout')return;if(!signedInMember){try{const user=await YG_api('/api/auth/me');if(user.role==='client')signedInMember=user;}catch(_){}}$('#checkoutButton').click();requestAnimationFrame(()=>{if(!$('#checkoutModal').classList.contains('open'))return;const panel=$('.checkout-panel');if(panel)panel.scrollTop=0;const address=$('#checkoutForm [name="address"]');if(address)address.focus({preventScroll:true});if(window.parent!==window)window.parent.postMessage({type:'yg-checkout-opened'},location.origin);});});
function validateCheckoutStep(step){const invalid=$(`.checkout-step[data-step="${step}"]`).querySelector(':invalid');if(!invalid)return true;invalid.reportValidity();return false;}
function configureReviewFirstCheckout(){document.querySelector('.checkout-progress').innerHTML='<span class="active">1 Verify address</span><span>2 Confirm request</span>';const paymentStep=document.querySelector('.checkout-step[data-step="2"]');paymentStep.innerHTML='<p class="eyebrow">Final verification</p><h2>Confirm your order and address.</h2><p class="checkout-review-intro">Please verify the recipient, contact number, complete address, and landmark. Only after you confirm these details will the order be sent to the administrator.</p><div id="deliveryReview" class="order-review"></div><div id="orderReview" class="order-review"></div><label class="consent"><input required type="checkbox"> I confirm that my order, delivery address, contact details, and landmark are complete and correct.</label>';document.querySelector('.checkout-step[data-step="3"]').remove();}
configureReviewFirstCheckout();
function showStep(step) {
  checkoutStep=step;
  document.querySelectorAll('.checkout-step').forEach((element,index)=>element.classList.toggle('active',index===step-1));
  document.querySelectorAll('.checkout-progress span').forEach((element,index)=>element.classList.toggle('active',index<=step-1));
  $('#checkoutBack').style.visibility=step===1?'hidden':'visible';
  $('#checkoutNext').innerHTML=step===2?'Confirm and message <span>→</span>':'Continue <span>→</span>';
  if(step===2){
    const form=new FormData($('#checkoutForm'));
    const total=Object.entries(cart).reduce((sum,[id,quantity])=>sum+products.find(product=>product.id===id).price*quantity,0);
    $('#deliveryReview').innerHTML=`<div class="review-row"><span>Recipient</span><b>${escapeHtml(form.get('name')||'')}</b></div><div class="review-row"><span>Mobile number</span><b>${escapeHtml(form.get('phone')||'')}</b></div><div class="review-row"><span>Complete address</span><b>${escapeHtml(form.get('address')||'')}</b></div><div class="review-row"><span>Landmark</span><b>${escapeHtml(form.get('landmark')||'')}</b></div><div class="review-row"><span>Region / postal code</span><b>${escapeHtml(form.get('region')||'')} · ${escapeHtml(form.get('postal')||'')}</b></div>`;
    $('#orderReview').innerHTML=Object.entries(cart).map(([id,quantity])=>{const product=products.find(item=>item.id===id);return `<div class="review-row"><span>${quantity} × ${product.name}</span><b>${money(product.price*quantity)}</b></div>`;}).join('')+`<div class="review-row"><span>Delivery fee</span><b>Confirmed by admin after address review</b></div><div class="review-row"><strong>Products subtotal</strong><strong>${money(total)}</strong></div>`;
  }
}

$('#sort').onchange=renderProducts;
$('#shopMenuButton').onclick=()=>{const open=document.querySelector('.store-site-header').classList.toggle('open');$('#shopMenuButton').setAttribute('aria-expanded',String(open));};
document.querySelectorAll('.store-site-header nav a').forEach(link=>link.onclick=()=>document.querySelector('.store-site-header').classList.remove('open'));
$('#cartTrigger').onclick=()=>toggleCart(true); $('#closeCart').onclick=()=>toggleCart(false); $('#drawerBackdrop').onclick=()=>toggleCart(false);
if(new URLSearchParams(location.search).get('cart')==='open'){
  requestAnimationFrame(()=>toggleCart(true));
}
function cartOrderItems(){return Object.entries(cart).map(([id,quantity])=>{const product=products.find(item=>item.id===id);return {id,name:product.name,quantity,price:product.price};});}
async function submitOrderRequest(payload){
  const saved=await YG_api('/api/orders',{method:'POST',body:JSON.stringify(payload)});
  await YG_api('/api/messages',{method:'POST',body:JSON.stringify({text:`I verified the recipient, contact number, complete delivery address, and landmark for order ${saved.number}. Please review the order and advise the delivery fee.`})});
  cart={};saveCart();$('#checkoutModal').classList.remove('open');showToast(`Order ${saved.number} sent for review`);
  setTimeout(()=>{if(window.parent!==window)window.parent.postMessage({type:'yg-open-messages',order:saved.number},location.origin);else location.href=`/account?panel=messages&order=${encodeURIComponent(saved.number)}`;},350);
  return saved;
}
$('#checkoutButton').onclick=async()=>{
  if(!Object.keys(cart).length)return showToast('Your bag is empty');
  if(!signedInMember){showToast('Please sign in before confirming your order.');setTimeout(()=>location.href='/account',900);return;}
  toggleCart(false);
  const form=$('#checkoutForm');
  form.reset();
  form.elements.name.value=signedInMember.name||'';
  form.elements.phone.value=signedInMember.phone||'';
  form.elements.email.value=signedInMember.email||'';
  form.elements.address.value=signedInMember.address||'';
  $('#checkoutAccountNote').innerHTML='<div><b>Verify before sending</b><small>Your order will not reach the administrator until you confirm the address and landmark.</small></div><a href="/account?panel=profile">Update profile</a>';
  $('#checkoutModal').classList.add('open');
  showStep(1);
};
$('#closeCheckout').onclick=()=>{$('#checkoutModal').classList.remove('open');if(window.parent!==window)window.parent.postMessage({type:'yg-checkout-closed'},location.origin);}; $('#checkoutBack').onclick=()=>showStep(checkoutStep-1);
$('#checkoutNext').onclick=async()=>{
  if(checkoutStep<2){
    if(!validateCheckoutStep(1))return;
    showStep(checkoutStep+1);return;
  }
  if(!$('#checkoutForm').reportValidity())return;
  const formData=new FormData($('#checkoutForm'));
  const items=cartOrderItems();
  const payload={customer:formData.get('name'),email:formData.get('email'),phone:formData.get('phone'),address:formData.get('address'),landmark:formData.get('landmark'),region:formData.get('region'),postal:formData.get('postal'),items};
  $('#checkoutNext').disabled=true; $('#checkoutNext').textContent='Saving…';
  try {
    await submitOrderRequest(payload);
  } catch(error) { showToast(error.message||'Could not save the order. Please try again.'); }
  finally { $('#checkoutNext').disabled=false; $('#checkoutNext').innerHTML='Confirm and message <span>→</span>'; }
};
async function initializeStore(){
  try{
    const documentOrder=['Tirzepatide 15 mg','Tirzepatide 30 mg','GHK-Cu 50 mg','NAD+ 50 mg'];
    products=(await YG_api('/api/products')).filter(product=>product.isActive!==false).sort((a,b)=>documentOrder.indexOf(a.name)-documentOrder.indexOf(b.name));
    Object.keys(cart).forEach(id=>{if(!products.some(product=>product.id===id))delete cart[id];});
    localStorage.setItem('yg-cart',JSON.stringify(cart));
    renderProducts();renderCart();
  }catch(error){
    $('#productGrid').innerHTML='<p>Products could not be loaded. Please refresh the page.</p>';
    showToast(error.message);
  }
}
initializeStore();
YG_api('/api/auth/me').then(user=>{if(user.role==='client'){signedInMember=user;localStorage.setItem('yg-customer-display',JSON.stringify({name:user.name}));$('#accountTrigger').setAttribute('aria-label',`Customer profile for ${user.name}`);}}).catch(()=>{localStorage.removeItem('yg-customer-display');$('#accountTrigger').setAttribute('aria-label','Customer profile');});
