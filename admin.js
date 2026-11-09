if (location.pathname === '/admin.html') {
  history.replaceState(null, '', `/admin${location.search}${location.hash}`);
}

let products=window.YG_getProducts(),orders=[],clients=[],administrators=[],paymentMethods=[],selectedClient=null;
let productPage=1;
let orderPage=1,inventoryStockPage=1,inventoryExpiryPage=1,customerPage=1,administratorPage=1;
let knownUnreadCount=0;
let activeOrderFolder='pending';
const productsPerPage=10;
const adminItemsPerPage=10;
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value||0);
const $=selector=>document.querySelector(selector);
function toast(message){const element=$('#adminToast');element.textContent=message;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),2600);}
function escapeHtml(text){const node=document.createElement('div');node.textContent=text;return node.innerHTML;}
function renderListPagination(id,total,page,onChange){const pagination=$(`#${id}`),totalPages=Math.max(1,Math.ceil(total/adminItemsPerPage)),safePage=Math.min(Math.max(1,page),totalPages),start=total?(safePage-1)*adminItemsPerPage+1:0,end=Math.min(safePage*adminItemsPerPage,total);pagination.innerHTML=`<span>Showing <b>${start}–${end}</b> of <b>${total}</b></span><div><button type="button" data-list-page="${safePage-1}" ${safePage===1?'disabled':''} aria-label="Previous page">←</button>${Array.from({length:totalPages},(_,index)=>`<button type="button" data-list-page="${index+1}" class="${safePage===index+1?'active':''}">${index+1}</button>`).join('')}<button type="button" data-list-page="${safePage+1}" ${safePage===totalPages?'disabled':''} aria-label="Next page">→</button></div>`;pagination.querySelectorAll('[data-list-page]').forEach(button=>button.onclick=()=>{if(!button.disabled)onChange(Number(button.dataset.listPage));});return safePage;}
function renderCategoryOptions(){
  const defaults=['Weight Management','Skin & Beauty','Energy & Vitality','Protein','Vitamins'];
  const categories=[...new Set([...defaults,...products.map(product=>product.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  $('#categoryOptions').innerHTML=categories.map(category=>`<option value="${escapeHtml(category)}"></option>`).join('');
}
function orderDate(order){const date=new Date(order.date);return Number.isNaN(date.getTime())?null:date;}
function verifiedRevenue(list=orders){return list.filter(order=>order.paymentStatus==='verified'&&order.deliveryStatus!=='cancelled').reduce((sum,order)=>sum+Number(order.total||0),0);}
function renderSalesChart(){
  const select=$('.sales-panel select'),days=select?.value.includes('30')?30:7,end=new Date();end.setHours(23,59,59,999);
  const points=Array.from({length:days},(_,offset)=>{const date=new Date(end);date.setDate(end.getDate()-(days-1-offset));date.setHours(0,0,0,0);const next=new Date(date);next.setDate(date.getDate()+1);const total=verifiedRevenue(orders.filter(order=>{const placed=orderDate(order);return placed&&placed>=date&&placed<next;}));return{date,total};});
  const maximum=Math.max(...points.map(point=>point.total),0),axisMaximum=maximum?Math.ceil(maximum/1000)*1000:1000;
  const labels=$('.chart-labels');labels.innerHTML=`<span>${money(axisMaximum)}</span><span>${money(axisMaximum*.67)}</span><span>${money(axisMaximum*.33)}</span><span>${money(0)}</span>`;
  $('.bars').innerHTML=points.map((point,index)=>`<i style="height:${point.total?Math.max(6,Math.round(point.total/axisMaximum*100)):2}%" title="${point.date.toLocaleDateString('en-PH',{month:'short',day:'numeric'})}: ${money(point.total)}"><b>${days===7?point.date.toLocaleDateString('en-PH',{weekday:'short'}):(index%5===0||index===days-1?point.date.toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'')}</b></i>`).join('');
  $('.sales-panel .eyebrow').textContent=`${money(points.reduce((sum,point)=>sum+point.total,0))} verified sales`;
}
function renderMetrics(){
  const newOrders=orders.filter(order=>order.deliveryStatus==='pending').length;
  const pendingPayments=orders.filter(order=>order.paymentStatus==='pending_verification').length;
  const lowStock=products.filter(product=>product.isActive!==false&&product.stock<=5);
  inventoryStockPage=Math.min(inventoryStockPage,Math.max(1,Math.ceil(lowStock.length/adminItemsPerPage)));
  const stockMarkup=lowStock.length
    ?lowStock.slice((inventoryStockPage-1)*adminItemsPerPage,inventoryStockPage*adminItemsPerPage).map(product=>`<div class="stock-row"><i>${product.short}</i><div><h3>${product.name}</h3><p>${product.batch} · reorder recommended</p></div><b>${product.stock} left</b></div>`).join('')
    :'<p class="empty-admin-state">No low-stock products.</p>';
  $('#pendingBadge').textContent=newOrders;
  $('#pendingBadge').hidden=newOrders===0;
  $('#orderCount').textContent=orders.length;
  $('#overviewProductCount').textContent=products.filter(product=>product.isActive!==false).length;
  const delivered=orders.filter(order=>order.deliveryStatus==='delivered').length,activeOrders=orders.filter(order=>!['delivered','cancelled'].includes(order.deliveryStatus)).length;
  $('#revenue').textContent=money(verifiedRevenue());
  $('#attentionCount').textContent=pendingPayments+lowStock.length;
  $('#revenue').nextElementSibling.textContent='Verified payments only';
  $('#orderCount').nextElementSibling.textContent=`${activeOrders} active · ${delivered} delivered`;
  $('#overviewProductCount').nextElementSibling.textContent=`${products.reduce((sum,product)=>sum+Number(product.stock||0),0)} total units in stock`;
  $('#attentionCount').nextElementSibling.textContent=`${pendingPayments} payments · ${lowStock.length} low stock`;
  $('#stockAlerts').innerHTML=stockMarkup;
  $('#inventoryStockAlerts').innerHTML=stockMarkup;
  renderListPagination('inventoryStockPagination',lowStock.length,inventoryStockPage,page=>{inventoryStockPage=page;renderMetrics();});
  renderSalesChart();
}
function renderExpiry(){const today=new Date(),expiryProducts=products.filter(product=>product.expiry).sort((a,b)=>a.expiry.localeCompare(b.expiry));inventoryExpiryPage=Math.min(inventoryExpiryPage,Math.max(1,Math.ceil(expiryProducts.length/adminItemsPerPage)));$('#expiryRows').innerHTML=expiryProducts.slice((inventoryExpiryPage-1)*adminItemsPerPage,inventoryExpiryPage*adminItemsPerPage).map(product=>{const days=Math.ceil((new Date(product.expiry)-today)/86400000);return `<div class="expiry-row"><div><h3>${product.name}</h3><p>Batch ${product.batch} · ${product.stock} units</p></div><b>${days} days</b></div>`;}).join('')||'<p class="empty-admin-state">No expiry records.</p>';renderListPagination('inventoryExpiryPagination',expiryProducts.length,inventoryExpiryPage,page=>{inventoryExpiryPage=page;renderExpiry();});}
function renderProducts(){
  const active=products.filter(product=>product.isActive!==false);
  const totalPages=Math.max(1,Math.ceil(products.length/productsPerPage));
  productPage=Math.min(Math.max(1,productPage),totalPages);
  const pageStart=(productPage-1)*productsPerPage;
  const visibleProducts=products.slice(pageStart,pageStart+productsPerPage);
  $('#activeProductCount').textContent=active.length;$('#draftProductCount').textContent=products.length-active.length;$('#catalogStockCount').textContent=products.reduce((sum,p)=>sum+Number(p.stock||0),0);
  $('#productAdminGrid').innerHTML=products.length?visibleProducts.map(product=>`<article class="admin-product-card ${product.isActive===false?'is-hidden':''}"><div class="admin-product-visual ${product.tone}">${product.imageUrl?`<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">`:`<span>${escapeHtml(product.short)}</span>`}<b>${product.isActive===false?'Hidden':'Live'}</b></div><div class="admin-product-info"><p>${product.category}</p><h3>${product.name}</h3><div class="admin-product-meta"><span>${money(product.price)}</span><span>${product.stock} in stock</span></div><small>SKU ${product.sku} · Batch ${product.batch} · expires ${product.expiry}</small></div><div class="admin-product-controls"><label class="catalog-switch"><input type="checkbox" data-toggle-product="${product.id}" ${product.isActive!==false?'checked':''}><i></i><span>${product.isActive!==false?'Visible':'Hidden'}</span></label><button data-edit-product="${product.id}">Edit</button><button class="danger-link" data-delete-product="${product.id}">Delete</button></div></article>`).join(''):'<div class="empty-product-manager"><h3>No products yet</h3><p>Add your first product to begin building the storefront catalog.</p></div>';
  renderProductPagination(pageStart,totalPages);
  document.querySelectorAll('[data-toggle-product]').forEach(input=>input.onchange=async()=>{const product=products.find(item=>item.id===input.dataset.toggleProduct);input.disabled=true;try{const updated=await YG_api(`/api/products/${product.id}/visibility`,{method:'PATCH',body:JSON.stringify({isActive:input.checked})});products=products.map(item=>item.id===updated.id?updated:item);refreshProducts(`${updated.name} is now ${updated.isActive?'visible':'hidden'}`);}catch(error){input.checked=!input.checked;toast(error.message);}finally{input.disabled=false;}});
  document.querySelectorAll('[data-edit-product]').forEach(button=>button.onclick=()=>openProductModal(products.find(item=>item.id===button.dataset.editProduct)));
  document.querySelectorAll('[data-delete-product]').forEach(button=>button.onclick=async()=>{const product=products.find(item=>item.id===button.dataset.deleteProduct);if(!await YG_confirm({title:`Delete ${product.name}?`,message:'This permanently removes the product. Products with sales history should be hidden instead.',confirmText:'Delete product'}))return;try{await YG_api(`/api/products/${product.id}`,{method:'DELETE'});products=products.filter(item=>item.id!==product.id);refreshProducts(`${product.name} deleted`);}catch(error){toast(error.message);}});
}
function renderProductPagination(pageStart,totalPages){
  let pagination=$('#productPagination');
  if(!pagination){pagination=document.createElement('nav');pagination.id='productPagination';pagination.className='product-pagination';pagination.setAttribute('aria-label','Product pages');$('#productAdminGrid').after(pagination);}
  const first=products.length?pageStart+1:0,last=Math.min(pageStart+productsPerPage,products.length);
  pagination.innerHTML=`<span>Showing <b>${first}–${last}</b> of <b>${products.length}</b></span><div><button data-product-page="${productPage-1}" ${productPage===1?'disabled':''} aria-label="Previous product page">←</button>${Array.from({length:totalPages},(_,index)=>`<button data-product-page="${index+1}" class="${productPage===index+1?'active':''}">${index+1}</button>`).join('')}<button data-product-page="${productPage+1}" ${productPage===totalPages?'disabled':''} aria-label="Next product page">→</button></div>`;
  pagination.querySelectorAll('[data-product-page]').forEach(button=>button.onclick=()=>{if(button.disabled)return;productPage=Number(button.dataset.productPage);renderProducts();$('#products').scrollIntoView({behavior:'smooth',block:'start'});});
}
function refreshProducts(message){renderProducts();renderMetrics();renderExpiry();if(message)toast(message);}
function showProductImagePreview(url=''){const preview=$('#productImagePreview');preview.innerHTML=url?`<img src="${escapeHtml(url)}" alt="Product image preview">`:'<small>Upload a PNG, JPG, or WebP image up to 5 MB.</small>';}
function openProductModal(product=null){renderCategoryOptions();const form=$('#productForm');form.reset();form.elements.isActive.checked=true;$('#productModalTitle').textContent=product?'Edit product':'Add product';if(product)Object.entries(product).forEach(([key,value])=>{if(!form.elements[key])return;if(key==='isActive')form.elements[key].checked=value!==false;else form.elements[key].value=value;});showProductImagePreview(product?.imageUrl);$('#removeProductImageOption').hidden=!product?.imageUrl;$('#productModal').classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>form.elements.name.focus(),50);}
function closeProductModal(){$('#productModal').classList.remove('open');document.body.style.overflow='';}
$('#addProduct').onclick=()=>openProductModal();$('#closeProductModal').onclick=closeProductModal;$('#cancelProduct').onclick=closeProductModal;$('#productModal').onclick=event=>{if(event.target===$('#productModal'))closeProductModal();};
$('#productForm').elements.image.onchange=event=>{const file=event.target.files[0];if(file)showProductImagePreview(URL.createObjectURL(file));};
$('#productForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form),existingId=data.get('id'),button=form.querySelector('[type="submit"]');data.set('name',data.get('name').trim());data.set('short',data.get('short').trim().toUpperCase());data.set('category',data.get('category').trim());data.set('sku',existingId?products.find(item=>item.id===existingId)?.sku||'':'');data.set('batch',data.get('batch').trim().toUpperCase());data.set('benefit',data.get('benefit').trim());data.set('isActive',form.elements.isActive.checked?'1':'0');data.set('remove_image',form.elements.remove_image.checked?'1':'0');if(existingId)data.set('_method','PUT');button.disabled=true;button.textContent='Uploading…';try{const saved=await YG_api(existingId?`/api/products/${existingId}`:'/api/products',{method:'POST',body:data});products=existingId?products.map(item=>item.id===existingId?saved:item):[saved,...products];if(!existingId)productPage=1;closeProductModal();refreshProducts(`${saved.name} saved to MySQL`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Save product';}};
function orderFolderLabel(status){return {pending:'Pending',packing:'Packing',in_transit:'In Transit',delivered:'Delivered',cancelled:'Cancelled'}[status]||status;}
function renderOrders(){
  const folderOrders=orders.filter(order=>order.deliveryStatus===activeOrderFolder);
  orderPage=Math.min(orderPage,Math.max(1,Math.ceil(folderOrders.length/adminItemsPerPage)));
  const visibleOrders=folderOrders.slice((orderPage-1)*adminItemsPerPage,orderPage*adminItemsPerPage);
  document.querySelectorAll('[data-order-folder]').forEach(button=>{
    const status=button.dataset.orderFolder;
    button.classList.toggle('active',status===activeOrderFolder);
    button.setAttribute('aria-current',status===activeOrderFolder?'page':'false');
    button.querySelector('b').textContent=orders.filter(order=>order.deliveryStatus===status).length;
    button.onclick=()=>{activeOrderFolder=status;orderPage=1;renderOrders();};
  });
  $('#orderRows').innerHTML=folderOrders.length?visibleOrders.map(order=>`<tr><td>${order.number}</td><td>${escapeHtml(order.customer||'Guest')}</td><td>${order.date}</td><td>${order.payment}</td><td>${money(order.total)}</td><td><span class="status ${order.status.toLowerCase().replaceAll(' ','-')}">${order.status}</span></td><td><select class="order-action" data-order-status="${order.id}" aria-label="Change status for ${order.number}"><option value="pending" ${order.deliveryStatus==='pending'?'selected':''}>Pending</option><option value="packing" ${order.deliveryStatus==='packing'?'selected':''}>Packing</option><option value="in_transit" ${order.deliveryStatus==='in_transit'?'selected':''}>In transit</option><option value="delivered" ${order.deliveryStatus==='delivered'?'selected':''}>Delivered</option><option value="cancelled" ${order.deliveryStatus==='cancelled'?'selected':''}>Cancelled</option></select></td></tr>`).join(''):`<tr class="order-empty"><td colspan="7">No ${orderFolderLabel(activeOrderFolder).toLowerCase()} orders.</td></tr>`;
  renderListPagination('orderPagination',folderOrders.length,orderPage,page=>{orderPage=page;renderOrders();});
  document.querySelectorAll('[data-order-status]').forEach(select=>select.onchange=async()=>{const destination=select.value;select.disabled=true;try{await YG_api(`/api/orders/${select.dataset.orderStatus}`,{method:'PATCH',body:JSON.stringify({delivery_status:destination,payment_status:destination==='delivered'?'verified':undefined})});await loadOrders();toast(`Order moved to ${orderFolderLabel(destination)}`);}catch(error){select.disabled=false;toast(error.message);}});
}
async function loadOrders(){try{orders=await YG_api('/api/orders');renderOrders();renderMetrics();}catch(error){toast(error.message);}}
function updateInboxBadges(){const unread=clients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);['#inboxBadge','#floatingMessageBadge'].forEach(selector=>{const badge=$(selector);badge.textContent=unread;badge.hidden=unread===0;});}
function openCustomerModal(){$('#customerForm').reset();$('#customerModal').classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>$('#customerForm').elements.name.focus(),50);}
function closeCustomerModal(){$('#customerModal').classList.remove('open');document.body.style.overflow='';}
$('#addCustomer').onclick=openCustomerModal;$('#closeCustomerModal').onclick=closeCustomerModal;$('#cancelCustomer').onclick=closeCustomerModal;$('#customerModal').onclick=event=>{if(event.target===$('#customerModal'))closeCustomerModal();};
$('#customerForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=new FormData(form);if(data.get('password')!==data.get('password_confirmation'))return toast('Passwords do not match');const payload={name:data.get('name').trim(),email:data.get('email').trim().toLowerCase(),phone:data.get('phone').trim(),address:data.get('address').trim(),password:data.get('password'),password_confirmation:data.get('password_confirmation'),marketing_consent:data.get('marketing_consent')==='on'};button.disabled=true;button.textContent='Creating…';try{const created=await YG_api('/api/clients',{method:'POST',body:JSON.stringify(payload)});closeCustomerModal();await loadClients();await selectClient(created.userId);toast(`${created.name} added as a customer`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Create customer';}};
function renderAdministrators(){administratorPage=Math.min(administratorPage,Math.max(1,Math.ceil(administrators.length/adminItemsPerPage)));const visible=administrators.slice((administratorPage-1)*adminItemsPerPage,administratorPage*adminItemsPerPage);$('#administratorList').innerHTML=administrators.length?visible.map(admin=>`<article class="admin-user-row"><span>${escapeHtml(admin.name.split(' ').map(part=>part[0]).slice(0,2).join(''))}</span><div><strong>${escapeHtml(admin.name)}</strong><small>${escapeHtml(admin.email)}${admin.phone?` · ${escapeHtml(admin.phone)}`:''}</small></div><time>Added ${admin.createdAt}</time><b>${admin.isCurrent?'Current account':'Administrator'}</b><button type="button" data-edit-administrator="${admin.id}">Edit</button></article>`).join(''):'<p class="empty-admin-state">No administrator accounts found.</p>';renderListPagination('administratorPagination',administrators.length,administratorPage,page=>{administratorPage=page;renderAdministrators();});document.querySelectorAll('[data-edit-administrator]').forEach(button=>button.onclick=()=>openAdministratorModal(administrators.find(admin=>admin.id===Number(button.dataset.editAdministrator))));}
async function loadAdministrators(){try{administrators=await YG_api('/api/admins');renderAdministrators();}catch(error){toast(error.message);}}
function renderPaymentSettings(){$('#paymentSettings').innerHTML=paymentMethods.map(method=>`<form class="payment-setting-card" data-payment-method="${method.id}"><div class="payment-setting-head"><div><span>${escapeHtml(method.code.replaceAll('_',' '))}</span><h3>${escapeHtml(method.name)}</h3></div><label class="catalog-switch"><input type="checkbox" name="is_active" ${method.isActive?'checked':''}><i></i><span>Displayed at checkout</span></label></div><div class="payment-setting-grid"><label>Display name<input required name="name" value="${escapeHtml(method.name)}"></label><label>Bank or wallet<input name="bank_name" value="${escapeHtml(method.bankName||'')}" placeholder="e.g. GCash or BDO"></label><label>Account name<input name="account_name" value="${escapeHtml(method.accountName||'')}" placeholder="Account holder"></label><label>Account number<input name="account_number" value="${escapeHtml(method.accountNumber||'')}" placeholder="Account or mobile number"></label><label class="wide">Customer instructions<textarea name="instructions" placeholder="Instructions shown during checkout">${escapeHtml(method.instructions||'')}</textarea></label><label class="payment-qr-upload">QR code<input type="file" name="qr" accept="image/png,image/jpeg,image/webp">${method.qrUrl?`<img src="${method.qrUrl}" alt="${escapeHtml(method.name)} QR code"><span><input type="checkbox" name="remove_qr"> Remove current QR</span>`:'<small>Upload PNG, JPG, or WebP up to 5 MB.</small>'}</label><label class="product-active-field"><input type="checkbox" name="requires_receipt" ${method.requiresReceipt?'checked':''}><span><b>Require payment receipt</b><small>Customers must upload proof before placing the order.</small></span></label></div><button class="primary-action" type="submit">Save ${escapeHtml(method.name)}</button></form>`).join('')||'<p class="empty-admin-state">No payment methods configured.</p>';document.querySelectorAll('[data-payment-method]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]'),data=new FormData(form);data.set('is_active',form.elements.is_active.checked?'1':'0');data.set('requires_receipt',form.elements.requires_receipt.checked?'1':'0');data.set('remove_qr',form.elements.remove_qr?.checked?'1':'0');button.disabled=true;button.textContent='Saving…';try{await YG_api(`/api/payment-methods/${form.dataset.paymentMethod}`,{method:'POST',body:data});await loadPaymentMethods();toast('Payment method updated');}catch(error){toast(error.message);}finally{button.disabled=false;}});}
async function loadPaymentMethods(){try{paymentMethods=await YG_api('/api/payment-methods');renderPaymentSettings();}catch(error){toast(error.message);}}
function openAdministratorModal(admin=null){const form=$('#administratorForm');form.reset();form.elements.id.value=admin?.id||'';form.elements.name.value=admin?.name||'';form.elements.email.value=admin?.email||'';form.elements.phone.value=admin?.phone||'';form.elements.password.required=!admin;form.elements.password_confirmation.required=!admin;$('#administratorModalTitle').textContent=admin?'Edit administrator':'Add administrator';$('#administratorPasswordLabel').textContent=admin?'New password (optional)':'Password';$('#administratorConfirmationLabel').textContent=admin?'Confirm new password':'Confirm password';form.querySelector('[type="submit"]').textContent=admin?'Save changes':'Create administrator';$('#administratorModal').classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>form.elements.name.focus(),50);}
function closeAdministratorModal(){$('#administratorModal').classList.remove('open');document.body.style.overflow='';}
$('#addAdministrator').onclick=openAdministratorModal;$('#closeAdministratorModal').onclick=closeAdministratorModal;$('#cancelAdministrator').onclick=closeAdministratorModal;$('#administratorModal').onclick=event=>{if(event.target===$('#administratorModal'))closeAdministratorModal();};
$('#administratorForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=new FormData(form),adminId=data.get('id'),password=data.get('password');if(password!==data.get('password_confirmation'))return toast('Passwords do not match');const payload={name:data.get('name').trim(),email:data.get('email').trim().toLowerCase(),phone:data.get('phone').trim(),password,password_confirmation:data.get('password_confirmation')};button.disabled=true;button.textContent='Saving…';try{const saved=await YG_api(adminId?`/api/admins/${adminId}`:'/api/admins',{method:adminId?'PUT':'POST',body:JSON.stringify(payload)});closeAdministratorModal();await loadAdministrators();toast(adminId?`${saved.name} updated`:`${saved.name} added as an administrator`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent=adminId?'Save changes':'Create administrator';}};
function renderClients(){updateInboxBadges();const directory=$('#customerDirectory'),inbox=$('#clientList');customerPage=Math.min(customerPage,Math.max(1,Math.ceil(clients.length/adminItemsPerPage)));if(!clients.length){directory.innerHTML='<p class="empty-admin-state">No registered customers yet.</p>';inbox.innerHTML='<p>No customer conversations yet.</p>';renderListPagination('customerPagination',0,1,()=>{});return;}const visibleCustomers=clients.slice((customerPage-1)*adminItemsPerPage,customerPage*adminItemsPerPage);directory.innerHTML=visibleCustomers.map(client=>`<article class="customer-directory-row"><span>${escapeHtml(client.name.split(' ').map(part=>part[0]).slice(0,2).join(''))}</span><div><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.email)} · ${escapeHtml(client.phone||'No phone saved')}</small></div><div><small>Customer type</small><b>${escapeHtml(client.segment)}</b></div><div><small>Completed orders</small><b>${client.completedOrders}</b></div><div><small>Lifetime spend</small><b>${money(client.totalSpend)}</b></div><div><small>Eligible offer</small><b>${escapeHtml(client.offer)}</b></div><button type="button" data-customer-message="${client.userId}">Message${client.unreadMessages?` (${client.unreadMessages})`:''}</button></article>`).join('');inbox.innerHTML=clients.map(client=>`<button class="client-card ${client===selectedClient?'active':''}" data-client="${client.userId}"><span>${client.name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span><div><strong>${escapeHtml(client.name)}</strong><small>${client.segment} client</small></div>${client.unreadMessages?`<b>${client.unreadMessages} new</b>`:''}</button>`).join('');renderListPagination('customerPagination',clients.length,customerPage,page=>{customerPage=page;renderClients();});document.querySelectorAll('[data-client]').forEach(button=>button.onclick=()=>selectClient(Number(button.dataset.client)));document.querySelectorAll('[data-customer-message]').forEach(button=>button.onclick=async()=>{openModule('messages');await selectClient(Number(button.dataset.customerMessage));});}
async function selectClient(userId){selectedClient=clients.find(c=>c.userId===userId);renderClients();$('#clientInitials').textContent=selectedClient.name.split(' ').map(p=>p[0]).slice(0,2).join('');$('#clientName').textContent=selectedClient.name;$('#clientContact').textContent=`${selectedClient.email} · ${selectedClient.phone||'No phone saved'}`;$('#clientSegment').textContent=selectedClient.segment;$('#clientOrders').textContent=selectedClient.completedOrders;$('#clientSpend').textContent=money(selectedClient.totalSpend);$('#clientOffer').textContent=selectedClient.offer;await renderAdminMessages();}
async function loadClients(autoOpenNew=false){try{const selectedId=selectedClient?.userId;const updatedClients=await YG_api('/api/clients');const unreadCount=updatedClients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);const hasNewMessage=autoOpenNew&&unreadCount>knownUnreadCount;clients=updatedClients;selectedClient=clients.find(client=>client.userId===selectedId)||clients[0]||null;knownUnreadCount=unreadCount;if(hasNewMessage){selectedClient=clients.find(client=>client.unreadMessages>0)||selectedClient;}renderClients();if(hasNewMessage&&selectedClient){toggleFloatingMessages(true);toast(`New message from ${selectedClient.name}`);}}catch(error){toast(error.message);}}
function renderFloatingMessages(list=[]){
  $('#floatingClientName').textContent=selectedClient?selectedClient.name:'Messages';
  $('#floatingMessageThread').innerHTML=list.length?list.map(message=>`<div class="floating-bubble ${message.from==='support'?'support':''}">${escapeHtml(message.text)}<small>${message.time}</small></div>`).join(''):'<p>No messages yet.</p>';
  $('#floatingMessageThread').scrollTop=$('#floatingMessageThread').scrollHeight;
}
async function renderAdminMessages(){if(!selectedClient){renderFloatingMessages();return;}const list=await YG_api(`/api/messages?user_id=${selectedClient.userId}`);selectedClient.unreadMessages=0;knownUnreadCount=clients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);renderClients();$('#adminMessages').innerHTML=list.map(message=>`<div class="admin-bubble ${message.from==='support'?'support':''}">${escapeHtml(message.text)}<small>${message.time}</small></div>`).join('')||'<p>No messages yet.</p>';$('#adminMessages').scrollTop=$('#adminMessages').scrollHeight;renderFloatingMessages(list);}
$('#adminReply').onsubmit=async event=>{event.preventDefault();if(!selectedClient)return toast('Select a customer first');const box=event.currentTarget.querySelector('textarea');try{await YG_api('/api/messages',{method:'POST',body:JSON.stringify({text:box.value,user_id:selectedClient.userId})});box.value='';await renderAdminMessages();toast('Reply sent to customer');}catch(error){toast(error.message);}};
function toggleFloatingMessages(open){$('#floatingMessagePanel').classList.toggle('open',open);$('#floatingMessageToggle').setAttribute('aria-expanded',String(open));if(open&&selectedClient)renderAdminMessages();}
$('#floatingMessageToggle').onclick=()=>{const opening=!$('#floatingMessagePanel').classList.contains('open');if(opening){const unreadClient=clients.find(client=>Number(client.unreadMessages||0)>0);if(unreadClient){selectedClient=unreadClient;renderClients();}}toggleFloatingMessages(opening);};
$('#hideFloatingMessages').onclick=()=>toggleFloatingMessages(false);
$('#floatingMessageReply').onsubmit=async event=>{event.preventDefault();if(!selectedClient)return toast('Select a customer first');const box=event.currentTarget.querySelector('textarea');try{await YG_api('/api/messages',{method:'POST',body:JSON.stringify({text:box.value,user_id:selectedClient.userId})});box.value='';await renderAdminMessages();toast('Reply sent to customer');}catch(error){toast(error.message);}};
const moduleDetails={
  overview:['Business overview','Good morning, Jasfer.','A quick look at sales, orders, and items that need attention.'],
  products:['Catalog management','Products','Create, update, hide, and organize products sold in the storefront.'],
  orders:['Order operations','Orders','Review payments and move customer orders through fulfillment.'],
  inventory:['Stock control','Inventory','Monitor quantities, low-stock items, batches, and expiry dates.'],
  payments:['Checkout settings','Payments','Configure payment methods, account details, and QR codes.'],
  customers:['Customer records','Customers','View registered customer profiles, order activity, and eligible offers.'],
  messages:['Customer care','Messages','Read and respond to customer support conversations.'],
  discounts:['Loyalty tools','Discounts','Manage valid offers and customer eligibility rules.'],
  administrators:['Access control','Administrators','Create and review authorized administrator accounts.'],
};

function openModule(moduleName,updateUrl=true){
  const name=moduleDetails[moduleName]?moduleName:'overview';
  document.querySelectorAll('[data-admin-module]').forEach(section=>section.classList.toggle('active',section.dataset.adminModule===name));
  document.querySelectorAll('[data-module]').forEach(button=>button.classList.toggle('active',button.dataset.module===name));
  const [kicker,title,description]=moduleDetails[name];
  $('#moduleKicker').textContent=kicker;
  $('#moduleTitle').textContent=title;
  $('#moduleDescription').textContent=description;
  if(updateUrl)history.replaceState(null,'',`#${name}`);
  if(name==='messages'&&selectedClient)selectClient(selectedClient.userId);
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('[data-module]').forEach(button=>button.onclick=()=>openModule(button.dataset.module));
document.querySelectorAll('[data-open-module]').forEach(button=>button.onclick=()=>openModule(button.dataset.openModule));
window.addEventListener('hashchange',()=>openModule(location.hash.slice(1),false));
$('#notificationsButton').onclick=()=>toast('Notifications are connected to database orders.');
$('.sales-panel select').onchange=renderSalesChart;
$('#adminSignOut').onclick=async()=>{const button=$('#adminSignOut');button.disabled=true;button.textContent='Signing out…';try{await YG_api('/api/auth/logout',{method:'POST'});location.href='/admin/login';}catch(error){button.disabled=false;button.textContent='Sign out';toast(error.message);}};
async function initializeAdmin(){
  try{
    const member=await YG_api('/api/auth/me');
    if(member.role!=='admin')throw new Error('Admin access required.');
    const hour=new Date().getHours(),greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
    $('#moduleTitle').textContent=`${greeting}, ${member.name.split(' ')[0]}.`;
    $('.avatar').textContent=member.name.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase();
    openModule(location.hash.slice(1)||'overview',false);
    if((location.hash.slice(1)||'overview')==='overview')$('#moduleTitle').textContent=`${greeting}, ${member.name.split(' ')[0]}.`;
    renderProducts();renderMetrics();renderExpiry();
    await Promise.all([loadOrders(),loadClients(),loadAdministrators(),loadPaymentMethods()]);
    window.setInterval(loadOrders,30000);
    window.setInterval(()=>loadClients(true),10000);
  }catch(_){
    location.href='/admin/login';
  }
}

initializeAdmin();
