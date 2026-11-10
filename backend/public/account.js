const messageStyles=document.createElement('link');messageStyles.rel='stylesheet';messageStyles.href='account-modern.css?v=61';document.head.appendChild(messageStyles);
const accountNav=document.querySelector('.portal-nav');
if(accountNav&&!accountNav.querySelector('.account-panel-brand')){
  accountNav.insertAdjacentHTML('afterbegin','<a class="portal-brand account-panel-brand" href="/" aria-label="You Glow Cebu home"><span>You Glow Cebu</span><small>Beauty &amp; Wellness</small></a>');
}
const $=selector=>document.querySelector(selector);
let member=null;
let customerOrderRecords=[];
let customerOrderFolder='active';
let customerPaymentMethods=[];
const wantsAdmin=new URLSearchParams(location.search).get('next')==='admin';
window.YG_PORTAL=wantsAdmin?'admin':'customer';
let profileCart={};
try{profileCart=JSON.parse(localStorage.getItem('yg-cart')||'{}')||{};}catch(_){profileCart={};}
const accountCartProducts=window.YG_getProducts();
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value||0);
function ensureSidebarCart(){let button=$('#accountCartTrigger');if(button)return button;button=document.createElement('button');button.type='button';button.id='accountCartTrigger';button.innerHTML='Cart <b id="profileCartCount" hidden>0</b>';const overview=document.querySelector('.portal-nav [data-panel="overview"]');overview.before(button);return button;}
ensureSidebarCart();
const dashboardButton=document.querySelector('.portal-nav [data-panel="overview"]');
if(dashboardButton)dashboardButton.firstChild.textContent='Dashboard';
localStorage.removeItem('yg-sidebar-collapsed');
function ensureAccountCheckoutButton(){const existing=$('#accountCheckoutButton');if(existing)return existing;const link=document.querySelector('.account-cart-summary a[href="/shop"]');if(!link)return null;const button=document.createElement('button');button.type='button';button.id='accountCheckoutButton';button.className=link.className;button.innerHTML='Continue to checkout <span>→</span>';link.replaceWith(button);return button;}
ensureAccountCheckoutButton();
function renderAccountCart(){let count=0,total=0;const rows=Object.entries(profileCart).map(([id,quantity])=>{const product=accountCartProducts.find(item=>item.id===id);if(!product)return'';count+=Number(quantity);total+=product.price*quantity;return `<div class="account-cart-line"><div class="account-cart-thumb ${product.tone}">${product.imageUrl?`<img src="${escapeHtml(product.imageUrl)}" alt="">`:escapeHtml(product.short)}</div><div><h3>${escapeHtml(product.name)}</h3><p>${money(product.price)}</p><div class="account-cart-quantity"><button data-account-cart-dec="${id}" aria-label="Decrease ${escapeHtml(product.name)} quantity">−</button><span>${quantity}</span><button data-account-cart-inc="${id}" aria-label="Increase ${escapeHtml(product.name)} quantity">+</button></div></div><button class="account-cart-remove" data-account-cart-remove="${id}" aria-label="Remove ${escapeHtml(product.name)}">×</button></div>`;}).join('');const countBadge=$('#profileCartCount');if(countBadge){countBadge.textContent=count;countBadge.hidden=count===0;}$('#accountCartSubtotal').textContent=money(total);$('#accountCartItems').innerHTML=rows||'<div class="empty-account-cart"><p class="script">Your ritual awaits</p><p>Your cart is currently empty.</p><a href="/shop">Browse products →</a></div>';document.querySelectorAll('[data-account-cart-inc]').forEach(button=>button.onclick=()=>{profileCart[button.dataset.accountCartInc]++;saveAccountCart();});document.querySelectorAll('[data-account-cart-dec]').forEach(button=>button.onclick=()=>{const id=button.dataset.accountCartDec;if(--profileCart[id]<=0)delete profileCart[id];saveAccountCart();});document.querySelectorAll('[data-account-cart-remove]').forEach(button=>button.onclick=()=>{delete profileCart[button.dataset.accountCartRemove];saveAccountCart();});}
function saveAccountCart(){localStorage.setItem('yg-cart',JSON.stringify(profileCart));renderAccountCart();}
function toggleAccountCart(open){$('#accountCartDrawer').classList.toggle('open',open);$('#accountCartBackdrop').classList.toggle('open',open);document.body.classList.toggle('account-cart-open',open);}
function closeEmbeddedCheckout(){const panel=$('#accountBrowserPanel');panel.classList.remove('active','checkout-only','checkout-ready');}
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='yg-cart-updated'){try{profileCart=JSON.parse(localStorage.getItem('yg-cart')||'{}')||{};}catch(_){profileCart={};}renderAccountCart();toggleAccountCart(true);}if(event.data?.type==='yg-checkout-opened')$('#accountBrowserPanel').classList.add('checkout-ready');if(event.data?.type==='yg-checkout-closed')closeEmbeddedCheckout();if(event.data?.type==='yg-open-messages'){closeEmbeddedCheckout();document.querySelector('[data-panel="messages"]')?.click();}});
renderAccountCart();
if(wantsAdmin){
  document.title='Admin Sign In | You Glow Cebu';
  document.body.classList.add('admin-signin-mode');
  const story=$('.auth-story');
  story.querySelector('.script').textContent='Administration';
  story.querySelector('h1').innerHTML='Manage your store.<br>Serve every customer.';
  story.querySelector('p:not(.script)').textContent='Sign in with an administrator account to manage products, orders, inventory, customers, messages, and discounts.';
  story.querySelector('ul').innerHTML='<li>Manage storefront products and stock</li><li>Review and fulfill customer orders</li><li>Support customers and manage valid offers</li>';
  story.querySelector('small').textContent='This area is restricted to authorized You Glow Cebu administrators.';
  $('[data-auth-tab="register"]').style.display='none';
  $('#forgotPasswordOpen').style.display='none';
  const form=$('#signInForm');
  form.querySelector('.eyebrow').textContent='Administrator access';
  form.querySelector('h2').textContent='Sign in to the admin dashboard.';
  form.querySelector('button').textContent='Open admin dashboard →';
  form.querySelector('.testing-hint').textContent='Use your authorized administrator credentials.';
}
function segmentFor(m){if(m.segment==='new_client')return{name:'New',label:'New client',rule:'No completed orders yet',reward:'NEW10 · 10% OFF'};if(m.segment==='old_client')return{name:'Loyal',label:'Loyal client',rule:`${m.completedOrders} completed orders · ${money(m.totalSpend)} lifetime spend`,reward:'LOYAL GLOW · 12% OFF'};return{name:'Returning',label:'Returning client',rule:`${m.completedOrders} completed orders`,reward:'WELCOME BACK'};}
function ensureCustomerMessageShortcut(){let button=$('#customerMessageShortcut');if(button)return button;button=document.createElement('button');button.id='customerMessageShortcut';button.className='customer-message-shortcut';button.type='button';button.setAttribute('aria-label','Open support messages');button.innerHTML='<b hidden>0</b>';button.onclick=()=>document.querySelector('[data-panel="messages"]').click();document.body.append(button);return button;}
function renderOverview(unreadCount=0){
  const completed=Number(member.completedOrders||0);
  const latest=customerOrderRecords[0];
  const cards=document.querySelectorAll('.benefit-grid article');
  $('.portal-welcome>div>p:last-child').textContent='Manage your purchases, support conversations, and account details.';
  cards[0].querySelector('span').textContent='Order history';
  cards[0].querySelector('strong').textContent=`${completed} completed ${completed===1?'order':'orders'}`;
  cards[0].querySelector('p').textContent=completed?`${money(member.totalSpend)} spent on completed orders.`:'Your completed purchases will be recorded here.';
  const ordersButton=cards[0].querySelector('button');
  ordersButton.textContent=customerOrderRecords.length?'View order history →':'Browse products →';
  ordersButton.onclick=()=>customerOrderRecords.length?document.querySelector('[data-panel="orders"]').click():openAccountPage('shop');
  cards[1].querySelector('span').textContent='Latest order';
  cards[1].querySelector('strong').textContent=latest?.number||'No orders yet';
  cards[1].querySelector('p').textContent=latest?`${latest.status} · ${money(latest.total)}`:'Your most recent order will appear here.';
  const orderLink=cards[1].querySelector('a');
  orderLink.textContent=latest?'View order →':'Start shopping →';
  orderLink.onclick=event=>{event.preventDefault();latest?document.querySelector('[data-panel="orders"]').click():openAccountPage('shop');};
  cards[2].querySelector('span').textContent='Messages';
  cards[2].querySelector('strong').textContent=unreadCount?`${unreadCount} unread`:'Support inbox';
  cards[2].querySelector('p').textContent=unreadCount?'You have a new reply from the support team.':'Ask about an order or get product assistance.';
  cards[2].querySelector('a').textContent='Open messages →';
  $('.privacy-note b').textContent='Private account';
  $('.privacy-note span').textContent='Your profile, orders, and messages are visible only to you and authorized support staff.';
}
function toast(text){$('#accountToast').textContent=text;$('#accountToast').classList.add('show');setTimeout(()=>$('#accountToast').classList.remove('show'),2600);}
function customerInitials(){return member.name.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase();}
function renderCustomerProfilePhoto(url=member.profilePhotoUrl){const initials=customerInitials(),side=$('#memberInitials'),previewImage=$('#profilePhotoImage'),previewInitials=$('#profilePhotoInitials');side.innerHTML=url?`<img src="${escapeHtml(url)}" alt="${escapeHtml(member.name)}">`:escapeHtml(initials);previewInitials.textContent=initials;previewInitials.hidden=!!url;previewImage.hidden=!url;$('#removeProfilePhoto').hidden=!url;if(url)previewImage.src=url;else previewImage.removeAttribute('src');}
async function showPortal(){const seg=segmentFor(member);localStorage.setItem('yg-customer-display',JSON.stringify({name:member.name,profilePhotoUrl:member.profilePhotoUrl||null}));$('#authShell').style.display='none';$('#portal').classList.add('logged-in');$('#memberNameSide').textContent=member.name;$('#memberSegmentSide').textContent=seg.label;$('#welcomeName').textContent=member.name.split(' ')[0]+'.';$('#segmentName').textContent=seg.label;$('#segmentRule').textContent=seg.rule;const form=$('#profileForm');form.elements.name.value=member.name;form.elements.email.value=member.email;form.elements.phone.value=member.phone||'';form.elements.address.value=member.address||'';form.elements.landmark.value=member.landmark||'';form.elements.marketing.checked=!!member.marketing;form.elements.profile_photo.value='';form.elements.remove_profile_photo.value='0';renderCustomerProfilePhoto();const[,unreadCount]=await Promise.all([loadCustomerPaymentMethods().then(renderOrders),loadMessageBadge()]);renderOverview(unreadCount);const requested=new URLSearchParams(location.search).get('panel');if(requested&&document.querySelector(`[data-panel="${requested}"]`))document.querySelector(`[data-panel="${requested}"]`).click();}
function customerOrderGroup(order){const state=String(order.deliveryStatus||order.status||'').toLowerCase().replaceAll(' ','_');if(state==='delivered')return'delivered';if(['handed_over','in_transit'].includes(state))return'in_transit';if(state==='cancelled')return'cancelled';return'active';}
function renderCustomerOrderFolders(){let nav=$('.customer-order-folders');if(!nav){nav=document.createElement('nav');nav.className='customer-order-folders';nav.setAttribute('aria-label','Order status folders');nav.innerHTML='<button type="button" data-customer-order-folder="active">Pending &amp; Packing <b>0</b></button><button type="button" data-customer-order-folder="in_transit">In Transit <b>0</b></button><button type="button" data-customer-order-folder="delivered">Delivered <b>0</b></button><button type="button" data-customer-order-folder="cancelled">Cancelled <b>0</b></button>';$('#ordersPanel .panel-title').after(nav);nav.querySelectorAll('button').forEach(button=>button.onclick=()=>{customerOrderFolder=button.dataset.customerOrderFolder;renderCustomerOrderFolders();renderCustomerOrderList();});}nav.querySelectorAll('[data-customer-order-folder]').forEach(button=>{const folder=button.dataset.customerOrderFolder;const count=customerOrderRecords.filter(order=>customerOrderGroup(order)===folder).length;button.classList.toggle('active',folder===customerOrderFolder);button.setAttribute('aria-selected',String(folder===customerOrderFolder));button.querySelector('b').textContent=count;});}
function customerOrderFeedback(order){if(order.deliveryStatus!=='delivered')return'';return `<button type="button" class="rate-order" data-rate-order="${order.id}">${order.feedback?'Edit review':'Rate now'}</button>`;}
function ensureFeedbackDialog(){let dialog=$('#orderFeedbackDialog');if(dialog)return dialog;dialog=document.createElement('dialog');dialog.id='orderFeedbackDialog';dialog.className='feedback-dialog';dialog.innerHTML='<form method="dialog" class="feedback-dialog-card"><header><div><span>Verified order feedback</span><h3>Rate your order</h3><small id="feedbackOrderNumber"></small></div><button type="button" class="feedback-dialog-close" aria-label="Close review form">×</button></header><fieldset><legend>Your rating</legend><div class="star-rating" id="feedbackStars"></div></fieldset><label class="feedback-comment">Your comment<textarea name="comment" minlength="5" maxlength="1000" required placeholder="Tell us about the products, delivery, and service…"></textarea></label><p>Your first name and last initial will appear after the administrator approves this verified-order review.</p><button type="submit" class="feedback-submit">Submit feedback</button></form>';document.body.append(dialog);dialog.querySelector('.feedback-dialog-close').onclick=()=>dialog.close();dialog.onclick=event=>{if(event.target===dialog)dialog.close();};dialog.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('.feedback-submit'),data=Object.fromEntries(new FormData(form)),originalLabel=button.textContent;button.disabled=true;button.textContent='Saving…';try{await YG_api('/api/feedback',{method:'POST',body:JSON.stringify({order_id:Number(dialog.dataset.orderId),rating:Number(data.rating),comment:data.comment})});dialog.close();toast('Feedback submitted for administrator review.');await renderOrders();}catch(error){button.disabled=false;button.textContent=originalLabel;toast(error.message);}};return dialog;}
function openFeedbackDialog(order){const dialog=ensureFeedbackDialog(),rating=Number(order.feedback?.rating||0);dialog.dataset.orderId=order.id;$('#feedbackOrderNumber').textContent=order.number;$('#feedbackStars').innerHTML=[5,4,3,2,1].map(value=>`<input type="radio" id="feedback-star-${value}" name="rating" value="${value}" ${rating===value?'checked':''} required><label for="feedback-star-${value}" title="${value} star${value===1?'':'s'}">★</label>`).join('');dialog.querySelector('textarea').value=order.feedback?.comment||'';dialog.querySelector('.feedback-submit').textContent=order.feedback?'Save changes':'Submit feedback';dialog.querySelector('.feedback-submit').disabled=false;dialog.showModal();}
function renderCustomerOrderList(){const orders=customerOrderRecords.filter(order=>customerOrderGroup(order)===customerOrderFolder);$('#customerOrders').innerHTML=orders.length?orders.map(o=>`<article class="customer-order"><div class="order-primary"><span>Order number</span><strong>${escapeHtml(o.number)}</strong></div><div class="order-detail"><span>Placed</span><strong>${escapeHtml(o.date)}</strong></div><div class="order-detail order-total"><span>Total</span><strong>${money(o.total)}</strong></div><div class="order-state"><span class="status ${o.status.toLowerCase().replaceAll(' ','-')}">${escapeHtml(o.status)}</span>${o.deliveryStatus==='pending'?`<button type="button" class="cancel-order" data-cancel-order="${o.id}">Cancel order</button>`:''}${['handed_over','in_transit'].includes(o.deliveryStatus)?`<button type="button" class="receive-order" data-receive-order="${o.id}">Confirm received</button>`:''}${customerOrderFeedback(o)}</div><div class="order-module-details">${customerOrderDetails(o)}</div></article>`).join(''):`<div class="empty-customer-orders"><strong>No ${customerOrderFolder==='active'?'pending or packing':customerOrderFolder.replace('_',' ')} orders</strong><p>Orders with this status will appear here.</p>${customerOrderRecords.length?'':'<a href="shop.html">Browse products →</a>'}</div>`;document.querySelectorAll('[data-cancel-order]').forEach(button=>button.onclick=async()=>{if(!await YG_confirm({title:'Cancel this order?',message:'The pending order will be cancelled and cannot be restored.',confirmText:'Cancel order'}))return;button.disabled=true;button.textContent='Cancelling…';try{await YG_api(`/api/orders/${button.dataset.cancelOrder}`,{method:'PATCH',body:JSON.stringify({delivery_status:'cancelled'})});toast('Order cancelled');await renderOrders();}catch(error){button.disabled=false;button.textContent='Cancel order';toast(error.message);}});document.querySelectorAll('[data-receive-order]').forEach(button=>button.onclick=async()=>{if(!await YG_confirm({title:'Confirm order received?',message:'Confirm only when the complete order has been delivered to you.',confirmText:'Confirm received',tone:'confirm'}))return;button.disabled=true;button.textContent='Confirming…';try{await YG_api(`/api/orders/${button.dataset.receiveOrder}`,{method:'PATCH',body:JSON.stringify({delivery_status:'delivered'})});toast('Order marked as received');await renderOrders();}catch(error){button.disabled=false;button.textContent='Confirm received';toast(error.message);}});document.querySelectorAll('[data-rate-order]').forEach(button=>button.onclick=()=>{const order=customerOrderRecords.find(item=>Number(item.id)===Number(button.dataset.rateOrder));if(order)openFeedbackDialog(order);});}
async function renderOrders(){try{customerOrderRecords=await YG_api('/api/orders');renderCustomerOrderFolders();renderCustomerOrderList();return customerOrderRecords;}catch(error){toast(error.message);return[];}}
function setMessageBadge(count){const value=Number(count)||0;const badge=$('#messageBadge');badge.textContent=value;badge.hidden=value===0;const shortcut=ensureCustomerMessageShortcut().querySelector('b');shortcut.textContent=value;shortcut.hidden=value===0;}
async function loadMessageBadge(){try{const result=await YG_api('/api/messages/unread-count');setMessageBadge(result.count);return Number(result.count||0);}catch(_){setMessageBadge(0);return 0;}}
async function loadCustomerPaymentMethods(){try{customerPaymentMethods=await YG_api('/api/payment-methods');}catch(_){customerPaymentMethods=[];}}
function orderWorkflowPanel(order){const address=order.address||{};if(order.workflowStatus==='awaiting_admin_review')return `<div class="customer-workflow-note"><b>Admin review in progress</b><p>The administrator will review your order and confirm the delivery fee here.</p><button type="button" class="transaction-secondary" data-cancel-order="${order.id}">Cancel order</button></div>`;if(order.workflowStatus==='awaiting_address_confirmation')return `<form class="customer-delivery-confirm" data-delivery-confirm="${order.id}"><b>Verify your delivery details</b><label>Delivery address<textarea name="address" required>${escapeHtml(address.address||member.address||'')}</textarea></label><div><label>Region<input name="region" value="${escapeHtml(address.region||'')}"></label><label>Postal code<input name="postal" value="${escapeHtml(address.postal||'')}"></label></div><p>Confirmed delivery fee: <strong>${money(order.shippingAmount)}</strong></p><div class="delivery-fee-choices"><button name="delivery_fee_payment" value="included">Include fee in payment</button><button name="delivery_fee_payment" value="pay_on_arrival">Pay rider on arrival</button></div></form>`;if(order.workflowStatus==='awaiting_admin_total_confirmation')return `<div class="customer-workflow-note"><b>Waiting for total confirmation</b><p>You selected ${order.deliveryFeePayment==='pay_on_arrival'?'payment of the delivery fee upon arrival':'inclusion of the delivery fee in your payment'}. The administrator must confirm the final total before payment becomes available.</p></div>`;if(order.workflowStatus==='awaiting_payment')return `<form class="customer-order-payment" data-order-payment="${order.id}"><b>Proceed with payment</b><p>${order.deliveryFeePayment==='pay_on_arrival'?`Pay ${money(order.shippingAmount)} directly to the delivery personnel. Your online payment total is ${money(order.total)}.`:`The delivery fee is included. Total payment: ${money(order.total)}.`}</p><label>Payment method<select name="payment" required>${customerPaymentMethods.map(method=>`<option value="${escapeHtml(method.name)}">${escapeHtml(method.name)}</option>`).join('')}</select></label><label>Proof of payment<input type="file" name="receipt" accept="image/jpeg,image/png,image/webp"></label><button type="submit">Submit payment</button></form>`;if(order.workflowStatus==='payment_verification')return '<div class="customer-workflow-note"><b>Payment submitted</b><p>The administrator is reviewing your payment proof.</p></div>';if(order.workflowStatus==='ready_for_fulfillment')return '<div class="customer-workflow-note"><b>Preparing your order</b><p>Payment is confirmed. The administrator will update you when the order is in transit.</p></div>';if(order.workflowStatus==='in_transit'||['handed_over','in_transit'].includes(order.deliveryStatus))return `<div class="customer-workflow-note"><b>Order is in transit</b><p>Confirm only after the complete order has arrived.</p><button type="button" data-receive-order="${order.id}">Confirm order received</button></div>`;if(order.workflowStatus==='completed')return '<div class="customer-workflow-note"><b>Transaction completed</b><p>Thank you. This order has been delivered and completed.</p></div>';return '';}
function bindCustomerTransactionActions(){document.querySelectorAll('[data-delivery-confirm]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const submitter=event.submitter;if(!submitter?.value)return;const data=Object.fromEntries(new FormData(form));data.delivery_fee_payment=submitter.value;submitter.disabled=true;try{await YG_api(`/api/orders/${form.dataset.deliveryConfirm}/confirm-delivery`,{method:'POST',body:JSON.stringify(data)});toast('Delivery fee option saved. Waiting for the administrator to confirm the total.');await renderOrders();await renderMessages();}catch(error){submitter.disabled=false;toast(error.message);}});document.querySelectorAll('[data-order-payment]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]'),data=new FormData(form);button.disabled=true;button.textContent='Submitting…';try{await YG_api(`/api/orders/${form.dataset.orderPayment}/payment`,{method:'POST',body:data});toast('Payment submitted for administrator verification.');await renderOrders();await renderMessages();}catch(error){button.disabled=false;button.textContent='Submit payment';toast(error.message);}});document.querySelectorAll('.message-transaction [data-cancel-order]').forEach(button=>button.onclick=async()=>{if(!await YG_confirm({title:'Cancel this order?',message:'This pending transaction will be cancelled.',confirmText:'Cancel order'}))return;await YG_api(`/api/orders/${button.dataset.cancelOrder}`,{method:'PATCH',body:JSON.stringify({delivery_status:'cancelled'})});await renderOrders();await renderMessages();toast('Order cancelled');});document.querySelectorAll('.message-transaction [data-receive-order]').forEach(button=>button.onclick=async()=>{if(!await YG_confirm({title:'Confirm order received?',message:'Confirm only after the complete order arrives.',confirmText:'Confirm received',tone:'confirm'}))return;await YG_api(`/api/orders/${button.dataset.receiveOrder}`,{method:'PATCH',body:JSON.stringify({delivery_status:'delivered'})});await renderOrders();await renderMessages();toast('Transaction completed');});}
function renderCustomerMessageTransaction(){let panel=$('.message-transaction');if(!panel){panel=document.createElement('section');panel.className='message-transaction';$('#customerMessageForm').before(panel);}const order=customerOrderRecords.find(item=>!['completed','cancelled'].includes(item.workflowStatus))||customerOrderRecords[0];panel.innerHTML=order?`<header><span>Order transaction</span><strong>${escapeHtml(order.number)}</strong><small>${escapeHtml(order.status)}</small></header>${orderWorkflowPanel(order)}`:'<div class="customer-workflow-note"><b>No active transaction</b><p>Add products to your cart to begin an order.</p></div>';bindCustomerTransactionActions();}
function compactAddressWorkflow(order){const address=order.address||{};return `<form class="customer-delivery-confirm delivery-fee-confirm" data-delivery-confirm="${order.id}"><input type="hidden" name="address" value="${escapeHtml(address.address||member.address||'')}"><input type="hidden" name="landmark" value="${escapeHtml(address.landmark||member.landmark||'')}"><input type="hidden" name="region" value="${escapeHtml(address.region||'')}"><input type="hidden" name="postal" value="${escapeHtml(address.postal||'')}"><b>Choose how to pay the delivery fee</b><p>The delivery fee is <strong>${money(order.shippingAmount)}</strong>. Select one option below. After your selection, the administrator will confirm your final payment total.</p><div class="delivery-fee-choices"><button name="delivery_fee_payment" value="included"><strong>Include in online payment</strong><small>Pay products and delivery together</small></button><button name="delivery_fee_payment" value="pay_on_arrival"><strong>Pay the delivery rider</strong><small>Pay ${money(order.shippingAmount)} when your order arrives</small></button></div></form>`;}
function customerTransactionSummary(order){return `<div class="transaction-total-summary"><span>Product total</span><strong>${money(order.subtotal)}</strong>${order.shippingAmount>0?`<small>Delivery fee: ${money(order.shippingAmount)}</small>`:''}${order.workflowStatus!=='awaiting_admin_review'&&order.workflowStatus!=='awaiting_address_confirmation'?`<small>Payment total: ${money(order.total)}</small>`:''}</div>`;}
function clearPaymentWorkflow(order){const feeOnArrival=order.deliveryFeePayment==='pay_on_arrival';return `<form class="customer-order-payment clear-payment-form chat-payment-form" data-order-payment="${order.id}"><div class="chat-payment-copy"><b>Payment is ready</b><strong>${money(order.total)}</strong><small>${feeOnArrival?`${money(order.shippingAmount)} delivery fee is paid separately to the rider.`:`Delivery fee of ${money(order.shippingAmount)} is included. Do not pay it again.`}</small></div><label>Method<select name="payment" required>${customerPaymentMethods.map(method=>`<option value="${escapeHtml(method.name)}">${escapeHtml(method.name)}</option>`).join('')}</select></label><label>Reference number<input name="payment_reference" maxlength="120" placeholder="e.g. 1234 5678 9012"></label><label class="chat-receipt-field">Receipt image<input type="file" name="receipt" accept="image/jpeg,image/png,image/webp"></label><button type="submit">Submit payment</button></form>`;}
function customerOrderDetails(order){const discount=Number(order.discountAmount||0);const items=(order.items||[]).map(item=>`<div class="order-detail-item"><span><b>${escapeHtml(item.name)}</b><small>${item.quantity} × ${money(item.price)}</small></span><strong>${money(item.lineTotal??item.price*item.quantity)}</strong></div>`).join('');return `<button type="button" class="view-order-details" data-toggle-order-details="${order.id}" aria-expanded="false">View order details <span>⌄</span></button><div class="message-order-details" data-order-details="${order.id}" hidden>${items}<dl><div><dt>Products subtotal</dt><dd>${money(order.subtotal)}</dd></div><div class="${discount>0?'has-discount':''}"><dt>Discount</dt><dd>${discount>0?`−${money(discount)}`:'No discount applied'}</dd></div>${order.shippingAmount>0?`<div><dt>Delivery fee</dt><dd>${money(order.shippingAmount)}</dd></div>`:''}<div class="order-detail-total"><dt>${order.deliveryFeePayment==='pay_on_arrival'?'Pay now':'Order total'}</dt><dd>${money(order.total)}</dd></div></dl></div>`;}
renderCustomerMessageTransaction=function(){$('.message-transaction')?.remove();const messages=$('#customerMessages');messages.querySelector('.transaction-chat-bubble')?.remove();const order=customerOrderRecords.find(item=>!['completed','cancelled'].includes(item.workflowStatus))||customerOrderRecords[0];if(!order)return;const content=order.workflowStatus==='awaiting_address_confirmation'?compactAddressWorkflow(order):(order.workflowStatus==='awaiting_payment'?clearPaymentWorkflow(order):orderWorkflowPanel(order));const bubble=document.createElement('div');bubble.className='bubble support transaction-chat-bubble';bubble.innerHTML=`<div class="chat-transaction-head"><span>Order ${escapeHtml(order.number)}</span><small>${escapeHtml(order.status)}</small></div><div class="chat-transaction-total"><span>Product total</span><strong>${money(order.subtotal)}</strong>${order.shippingAmount>0?`<small>Delivery ${money(order.shippingAmount)}</small>`:''}</div>${customerOrderDetails(order)}${content}`;messages.appendChild(bubble);bindCustomerTransactionActions();};
document.addEventListener('click',event=>{const open=event.target.closest('[data-open-payment]');if(open){const modal=document.querySelector(`[data-payment-modal="${open.dataset.openPayment}"]`);modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');return;}const close=event.target.closest('[data-close-payment]');if(close){const modal=close.closest('.payment-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');return;}if(event.target.classList.contains('payment-modal')){event.target.classList.remove('open');event.target.setAttribute('aria-hidden','true');}});
document.addEventListener('click',async event=>{const button=event.target.closest('.transaction-chat-bubble [data-receive-order]');if(!button)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();if(!await YG_confirm({title:'Did your order arrive?',message:'Please confirm only after you have received the complete order in good condition.',confirmText:'Yes, I received it',tone:'confirm'}))return;button.disabled=true;button.textContent='Confirming delivery…';try{await YG_api(`/api/orders/${button.dataset.receiveOrder}`,{method:'PATCH',body:JSON.stringify({delivery_status:'delivered'})});await renderOrders();await renderMessages();toast('Order received. Transaction completed.');}catch(error){button.disabled=false;button.textContent='Confirm order received';toast(error.message);}},true);
document.addEventListener('click',event=>{const button=event.target.closest('[data-toggle-order-details]');if(!button)return;const container=button.closest('.customer-order,.transaction-chat-bubble')||document;const details=container.querySelector(`[data-order-details="${button.dataset.toggleOrderDetails}"]`);if(!details)return;const open=details.hidden;details.hidden=!open;button.setAttribute('aria-expanded',String(open));button.firstChild.textContent=open?'Hide order details ':'View order details ';});
async function renderMessages(){try{const list=await YG_api('/api/messages');setMessageBadge(0);const messenger=$('.messenger');messenger.classList.add('single-thread');$('.conversation-head strong').textContent='You Glow Support';$('.conversation-head small').textContent=`Private conversation with ${member.name}`;$('.conversation-head>span').textContent='Order transaction';$('#customerMessages').innerHTML=list.map(m=>`<div class="bubble ${m.from==='customer'?'customer':''}"><strong class="message-author">${m.from==='customer'?'You':'You Glow Support'}</strong>${escapeHtml(m.text)}<small>${m.time}</small></div>`).join('')||'<div class="empty-message-thread"><strong>No messages yet</strong><p>Send a message if you need help with a product, payment, or order.</p></div>';renderCustomerMessageTransaction();$('#customerMessageForm textarea').placeholder='Write your message…';$('.message-disclaimer').textContent='For your security, do not share passwords, payment card details, or medical records.';$('#customerMessages').scrollTop=$('#customerMessages').scrollHeight;}catch(error){toast(error.message);}}
function escapeHtml(text){const node=document.createElement('div');node.textContent=text;return node.innerHTML;}
function renderMessageText(text=''){return String(text).split(/(https?:\/\/[^\s]+)/gi).map(part=>/^https?:\/\//i.test(part)?`<a class="message-link" href="${escapeHtml(part)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`:escapeHtml(part)).join('').replace(/\n/g,'<br>');}
function renderMessageBody(message){const text=message.text?`<div class="message-text">${renderMessageText(message.text)}</div>`:'';const photo=message.attachment?`<a class="message-photo" href="${escapeHtml(message.attachment.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(message.attachment.url)}" alt="${escapeHtml(message.attachment.name||'Attached photo')}" loading="lazy"><span>View photo</span></a>`:'';return text+photo;}
function setPasswordResetStep(step){
  const requesting=step==='request';
  $('#forgotPasswordForm').hidden=!requesting;
  $('#resetPasswordForm').hidden=requesting;
  $('#passwordResetTitle').textContent=requesting?'Reset your password':'Enter your verification code';
}
function togglePasswordReset(open,step='request'){
  const modal=$('#passwordResetModal');
  if(!modal)return;
  if(open)setPasswordResetStep(step);
  modal.classList.toggle('open',open);
  modal.setAttribute('aria-hidden',String(!open));
  document.body.classList.toggle('password-reset-open',open);
  if(open)setTimeout(()=>modal.querySelector('form:not([hidden]) input')?.focus(),40);
}
document.addEventListener('click',event=>{
  const toggle=event.target.closest('[data-password-toggle]');
  if(toggle){
    const input=toggle.closest('.password-field')?.querySelector('input');
    if(!input)return;
    const showing=input.type==='text';
    input.type=showing?'password':'text';
    toggle.textContent=showing?'Show':'Hide';
    toggle.setAttribute('aria-label',showing?'Show password':'Hide password');
    return;
  }
  if(event.target===$('#passwordResetModal'))togglePasswordReset(false);
});
$('#forgotPasswordOpen').onclick=()=>{
  $('#forgotPasswordForm').elements.email.value=$('#signInForm').elements.email.value;
  togglePasswordReset(true,'request');
};
$('#passwordResetClose').onclick=()=>togglePasswordReset(false);
$('#requestNewCode').onclick=()=>setPasswordResetStep('request');
$('#forgotPasswordForm').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
  button.disabled=true;button.textContent='Sending code…';
  try{
    const result=await YG_api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:form.elements.email.value})});
    $('#resetPasswordForm').elements.email.value=form.elements.email.value;
    setPasswordResetStep('verify');
    toast(result.message);
  }catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Send verification code';}
};
$('#resetPasswordForm').onsubmit=async event=>{
  event.preventDefault();
  const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
  if(form.elements.password.value!==form.elements.password_confirmation.value){toast('The password confirmation does not match.');return;}
  button.disabled=true;button.textContent='Changing password…';
  try{
    const data=Object.fromEntries(new FormData(form));
    const result=await YG_api('/api/auth/reset-password',{method:'POST',body:JSON.stringify(data)});
    $('#signInForm').elements.email.value=data.email;
    $('#signInForm').elements.password.value='';
    form.reset();togglePasswordReset(false);toast(result.message);
  }catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Change password';}
};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('#passwordResetModal')?.classList.contains('open'))togglePasswordReset(false);});
document.querySelectorAll('[data-auth-tab]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.auth-form').forEach(form=>form.classList.toggle('active',form.id===(button.dataset.authTab==='signin'?'signInForm':'registerForm')));});
$('#signInForm').onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));try{member=await YG_api('/api/auth/login',{method:'POST',body:JSON.stringify(data)});if(wantsAdmin&&member.role!=='admin')throw new Error('Please use an administrator account.');if(member.role==='admin'){location.href='/admin';return;}await showPortal();toast('Welcome back');}catch(error){toast(error.message);}};
$('#registerForm').onsubmit=async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));data.marketing=data.marketing==='on';try{member=await YG_api('/api/auth/register',{method:'POST',body:JSON.stringify(data)});await showPortal();toast('Your wellness profile is ready');}catch(error){toast(error.message);}};
document.querySelectorAll('[data-panel]').forEach(button=>button.onclick=async()=>{document.querySelectorAll('.portal-nav button').forEach(x=>x.classList.toggle('active',x===button));document.querySelectorAll('.portal-panel').forEach(panel=>panel.classList.remove('active'));$('#'+button.dataset.panel+'Panel').classList.add('active');if(button.dataset.panel==='messages')await renderMessages();});
function openAccountPage(page){const button=document.querySelector(`[data-account-page="${page}"]`);document.querySelectorAll('.portal-nav button').forEach(item=>item.classList.toggle('active',item===button));document.querySelectorAll('.portal-panel').forEach(panel=>panel.classList.remove('active'));$('#accountBrowserPanel').classList.add('active');const frame=$('#accountBrowser');const target=page==='shop'?'/products?embedded=account&design=2':'/?embedded=account&design=2';if(frame.dataset.page!==page){frame.dataset.page=page;frame.classList.remove('account-frame-ready');frame.src=target;}}
function openAccountCheckout(){toggleAccountCart(false);const panel=$('#accountBrowserPanel'),frame=$('#accountBrowser');panel.classList.add('active','checkout-only');panel.classList.remove('checkout-ready');const send=()=>frame.contentWindow?.postMessage({type:'yg-open-checkout'},location.origin);if(frame.dataset.page==='shop'&&frame.contentDocument?.readyState==='complete'){send();return;}frame.dataset.page='shop';frame.classList.remove('account-frame-ready');frame.addEventListener('load',send,{once:true});frame.src='/products?embedded=account&design=2';}
document.querySelectorAll('[data-account-page]').forEach(button=>button.onclick=()=>openAccountPage(button.dataset.accountPage));
$('#accountBrowser').addEventListener('load',()=>{const frame=$('#accountBrowser');try{const doc=frame.contentDocument;if(!doc)return;doc.documentElement.classList.add('inside-customer-account');const style=doc.createElement('style');style.textContent='.site-header,.announcement{display:none!important} body{padding-top:0!important}';doc.head.append(style);requestAnimationFrame(()=>frame.classList.add('account-frame-ready'));}catch(_){frame.classList.add('account-frame-ready');}});
document.querySelectorAll('[data-go]').forEach(link=>link.onclick=event=>{event.preventDefault();document.querySelector(`[data-panel="${link.dataset.go}"]`).click();});
document.querySelectorAll('[data-customer-order-folder]').forEach(button=>button.onclick=()=>{customerOrderFolder=button.dataset.customerOrderFolder;renderCustomerOrderFolders();renderCustomerOrderList();});
$('#customerMessageForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,box=form.querySelector('textarea'),photo=form.querySelector('[type="file"]');if(!box.value.trim()&&!photo.files.length)return toast('Write a message or attach a photo');const button=form.querySelector('button:not([type]),button[type="submit"]');button.disabled=true;try{await YG_api('/api/messages',{method:'POST',body:new FormData(form)});form.reset();YG_resetMessageAttachment(form);await renderMessages();toast('Message sent to support');}catch(error){toast(error.message);}finally{button.disabled=false;}};
$('#profileForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"],button:not([type])'),data=new FormData(form);data.set('_method','PUT');button.disabled=true;try{member=await YG_api('/api/auth/profile',{method:'POST',body:data});await showPortal();toast('Profile changes saved');}catch(error){toast(error.message);}finally{button.disabled=false;}};
$('#profileForm [name="profile_photo"]').addEventListener('change',event=>{const file=event.target.files?.[0];if(!file)return;event.currentTarget.form.elements.remove_profile_photo.value='0';const reader=new FileReader();reader.onload=()=>renderCustomerProfilePhoto(reader.result);reader.readAsDataURL(file);});
$('#removeProfilePhoto').onclick=()=>{const form=$('#profileForm');form.elements.profile_photo.value='';form.elements.remove_profile_photo.value='1';renderCustomerProfilePhoto(null);};
$('#accountCartTrigger').onclick=()=>toggleAccountCart(true);$('#closeAccountCart').onclick=()=>toggleAccountCart(false);$('#accountCartBackdrop').onclick=()=>toggleAccountCart(false);
$('#accountCheckoutButton').onclick=openAccountCheckout;
$('#signOut').onclick=async()=>{await YG_api('/api/auth/logout',{method:'POST',body:'{}'});localStorage.removeItem('yg-customer-display');location.reload();};
(async()=>{try{member=await YG_api('/api/auth/me');if(member.role==='admin'){location.href='/admin';return;}await showPortal();}catch(_){}})();
window.setInterval(()=>{if(member?.role==='client'&&!$('#messagesPanel').classList.contains('active'))loadMessageBadge();},10000);

let customerMessageSearchQuery='';
function filterCustomerMessages(){const query=customerMessageSearchQuery.trim().toLowerCase(),bubbles=[...document.querySelectorAll('#customerMessages>.bubble')];let matches=0;bubbles.forEach(bubble=>{const visible=!query||bubble.textContent.toLowerCase().includes(query);bubble.hidden=!visible;if(visible)matches++;});let empty=$('#customerMessageSearchEmpty');if(!empty){empty=document.createElement('p');empty.id='customerMessageSearchEmpty';empty.className='message-search-empty';$('#customerMessages').appendChild(empty);}empty.textContent='No messages match your search.';empty.hidden=!query||matches>0;}
function configureSingleAdminContact(){
  const threadList=document.querySelector('#messagesPanel .thread-list');
  if(threadList){
    threadList.innerHTML=`<div class="thread-search"><span aria-hidden="true"></span><input id="customerMessageSearch" type="search" placeholder="Search messages" aria-label="Search message history" value="${escapeHtml(customerMessageSearchQuery)}"></div><p class="thread-label">Direct support</p><button type="button" class="active single-admin-contact"><span>Orders & concerns</span><b>Contact Admin</b><small>Active conversation</small></button>`;
    $('#customerMessageSearch').addEventListener('input',event=>{customerMessageSearchQuery=event.target.value;filterCustomerMessages();});
  }
  const name=document.querySelector('#messagesPanel .conversation-head strong');
  const description=document.querySelector('#messagesPanel .conversation-head small');
  if(name)name.textContent='Contact Admin';
  if(description)description.textContent='Orders, payments, delivery and other concerns';
  document.querySelectorAll('#customerMessages .bubble:not(.customer) .message-author').forEach(author=>author.textContent='Admin');
  document.querySelectorAll('#customerMessages .bubble:not(.transaction-chat-bubble)').forEach(bubble=>{
    const sentTime=bubble.querySelector('small');
    if(!sentTime)return;
    bubble.classList.add('message-selectable');
    bubble.tabIndex=0;
    bubble.setAttribute('role','button');
    bubble.setAttribute('aria-expanded','false');
    bubble.title='Click to view message details';
    if(!sentTime.textContent.trim().startsWith('Sent '))sentTime.textContent=`Sent ${sentTime.textContent.trim()}`;
    const toggleDetails=()=>{
      const willOpen=!bubble.classList.contains('show-message-details');
      document.querySelectorAll('#customerMessages .show-message-details').forEach(item=>{
        item.classList.remove('show-message-details');
        item.setAttribute('aria-expanded','false');
      });
      bubble.classList.toggle('show-message-details',willOpen);
      bubble.setAttribute('aria-expanded',String(willOpen));
    };
    bubble.addEventListener('click',toggleDetails);
    bubble.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleDetails();}
    });
  });
  filterCustomerMessages();
}

renderCustomerMessageTransaction=function(){
  document.querySelectorAll('#customerMessages .active-transaction-bubble').forEach(item=>item.remove());
  const messages=$('#customerMessages');
  if(!messages)return;
  const activeOrder=customerOrderRecords.find(order=>!['completed','cancelled'].includes(order.workflowStatus)&&order.deliveryStatus!=='delivered');
  if(activeOrder){
    const content=activeOrder.workflowStatus==='awaiting_address_confirmation'?compactAddressWorkflow(activeOrder):(activeOrder.workflowStatus==='awaiting_payment'?clearPaymentWorkflow(activeOrder):orderWorkflowPanel(activeOrder));
    const bubble=document.createElement('div');
    bubble.className='bubble support transaction-chat-bubble active-transaction-bubble';
    const workflowLabel=activeOrder.workflowStatus==='awaiting_address_confirmation'?'Choose delivery payment':activeOrder.status;
    bubble.innerHTML=`<div class="chat-transaction-head"><span>Active order ${escapeHtml(activeOrder.number)}</span><small>${escapeHtml(workflowLabel)}</small></div><div class="chat-transaction-total"><span>Product total</span><strong>${money(activeOrder.subtotal)}</strong>${activeOrder.shippingAmount>0?`<small>Delivery fee: ${money(activeOrder.shippingAmount)}</small>`:''}</div>${customerOrderDetails(activeOrder)}${content}`;
    messages.appendChild(bubble);
  }
  bindCustomerTransactionActions();
};

renderMessages=async function(){
  try{
    const list=await YG_api('/api/messages');
    setMessageBadge(0);
    const completedOrders=customerOrderRecords.filter(order=>order.workflowStatus==='completed'||order.deliveryStatus==='delivered');
    const timeline=[
      ...list.map(message=>({type:'message',timestamp:Date.parse(message.timestamp)||0,message})),
      ...completedOrders.map(order=>({type:'completed-order',timestamp:Date.parse(order.completedAt)||0,order}))
    ].sort((a,b)=>a.timestamp-b.timestamp);
    $('#customerMessages').innerHTML=timeline.map(event=>{
      if(event.type==='message'){
        const message=event.message;
        return `<div class="bubble ${message.from==='customer'?'customer':''}"><strong class="message-author">${message.from==='customer'?'You':'Admin'}</strong>${renderMessageBody(message)}<small>${escapeHtml(message.time)}</small></div>`;
      }
      const order=event.order;
      return `<div class="bubble support transaction-chat-bubble completed-timeline-bubble"><div class="chat-transaction-head"><span>Order ${escapeHtml(order.number)}</span><small>${escapeHtml(order.completedTime||order.date)}</small></div><div class="chat-transaction-total"><span>Transaction completed</span><strong>${money(order.total)}</strong></div>${customerOrderDetails(order)}<div class="customer-workflow-note"><b>Order received</b><p>This order was delivered and completed.</p></div></div>`;
    }).join('')||'<div class="empty-message-thread"><strong>No messages yet</strong><p>Send a message if you need help with an order or another concern.</p></div>';
    renderCustomerMessageTransaction();
    $('#customerMessageForm textarea').placeholder='Write your message…';
    $('.message-disclaimer').textContent='For your security, do not share passwords, payment card details, or medical records.';
    configureSingleAdminContact();
    $('#customerMessages').scrollTop=$('#customerMessages').scrollHeight;
  }catch(error){toast(error.message);}
};

configureSingleAdminContact();

const customerMessageInput=document.querySelector('#customerMessageForm textarea');
if(customerMessageInput){
  customerMessageInput.form.querySelector('button:not([type]),button[type="submit"]')?.setAttribute('aria-label','Send message');
  customerMessageInput.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.shiftKey||event.isComposing)return;
    event.preventDefault();
    if(!customerMessageInput.value.trim()&&!customerMessageInput.form.querySelector('[type="file"]')?.files.length)return;
    customerMessageInput.form.requestSubmit();
  });
}
