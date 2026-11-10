if (location.pathname === '/admin.html') {
  history.replaceState(null, '', `/admin${location.search}${location.hash}`);
}

let products=window.YG_getProducts(),orders=[],clients=[],feedback=[],administrators=[],paymentMethods=[],discounts=[],selectedClient=null;
let productPage=1;
let orderPage=1,inventoryStockPage=1,inventoryExpiryPage=1,customerPage=1,administratorPage=1;
let knownUnreadCount=0;
let activeOrderFolder='pending';
let activeReportFolder='sales';
let messageClientQuery='';
const productsPerPage=10;
const adminItemsPerPage=10;
const money=value=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value||0);
const $=selector=>document.querySelector(selector);
function toast(message){const element=$('#adminToast');element.textContent=message;element.classList.add('show');setTimeout(()=>element.classList.remove('show'),2600);}
function escapeHtml(text){const node=document.createElement('div');node.textContent=text;return node.innerHTML;}
function renderMessageText(text=''){return String(text).split(/(https?:\/\/[^\s]+)/gi).map(part=>/^https?:\/\//i.test(part)?`<a class="message-link" href="${escapeHtml(part)}" target="_blank" rel="noopener noreferrer">${escapeHtml(part)}</a>`:escapeHtml(part)).join('').replace(/\n/g,'<br>');}
function renderMessageBody(message){const text=message.text?`<div class="message-text">${renderMessageText(message.text)}</div>`:'';const photo=message.attachment?`<a class="message-photo" href="${escapeHtml(message.attachment.url)}" target="_blank" rel="noopener"><img src="${escapeHtml(message.attachment.url)}" alt="${escapeHtml(message.attachment.name||'Attached photo')}" loading="lazy"><span>View photo</span></a>`:'';return text+photo;}
function adminCollectionArtwork(product){
  if(product.imageUrl)return product.imageUrl;
  const label=`${product.name||''} ${product.short||''}`.toLowerCase();
  if(label.includes('tirzepatide')||label.includes('trzz'))return label.includes('30')?'/assets/landing/tirzepatide-30mg.jpg':'/assets/landing/tirzepatide-15mg.jpg';
  if(label.includes('ghk'))return '/assets/landing/ghk-cu-50mg.jpg';
  if(label.includes('nad'))return '/assets/landing/nad-50mg.jpg';
  return '';
}
function renderListPagination(id,total,page,onChange){const pagination=$(`#${id}`),totalPages=Math.max(1,Math.ceil(total/adminItemsPerPage)),safePage=Math.min(Math.max(1,page),totalPages),start=total?(safePage-1)*adminItemsPerPage+1:0,end=Math.min(safePage*adminItemsPerPage,total);pagination.innerHTML=`<span>Showing <b>${start}–${end}</b> of <b>${total}</b></span><div><button type="button" data-list-page="${safePage-1}" ${safePage===1?'disabled':''} aria-label="Previous page">←</button>${Array.from({length:totalPages},(_,index)=>`<button type="button" data-list-page="${index+1}" class="${safePage===index+1?'active':''}">${index+1}</button>`).join('')}<button type="button" data-list-page="${safePage+1}" ${safePage===totalPages?'disabled':''} aria-label="Next page">→</button></div>`;pagination.querySelectorAll('[data-list-page]').forEach(button=>button.onclick=()=>{if(!button.disabled)onChange(Number(button.dataset.listPage));});return safePage;}
function renderCategoryOptions(){
  const defaults=['Weight Management','Skin & Beauty','Energy & Vitality','Protein','Vitamins'];
  const categories=[...new Set([...defaults,...products.map(product=>product.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b));
  $('#categoryOptions').innerHTML=categories.map(category=>`<option value="${escapeHtml(category)}"></option>`).join('');
}
function orderDate(order){const date=new Date(order.date);return Number.isNaN(date.getTime())?null:date;}
function verifiedRevenue(list=orders){return list.filter(order=>order.paymentStatus==='verified'&&order.deliveryStatus!=='cancelled').reduce((sum,order)=>sum+Math.max(0,Number(order.subtotal||0)-Number(order.discountAmount||0)),0);}
function renderDashboardFeedback(){
  const container=$('#dashboardFeedback');
  if(!container)return;
  const pending=feedback.filter(entry=>!entry.approved),approved=feedback.filter(entry=>entry.approved),ordered=[...pending,...approved];
  container.innerHTML=ordered.length?ordered.map(entry=>`<article class="dashboard-feedback-item ${entry.approved?'approved':'pending'}"><div class="feedback-review-head"><strong>${escapeHtml(entry.customer||'Customer')}</strong><span>${'★'.repeat(Math.max(0,Math.min(5,Number(entry.rating)||0)))}</span></div><small>${escapeHtml(entry.orderNumber||'Verified order')} · ${escapeHtml(entry.date||'')}</small><p>“${escapeHtml(entry.comment||'Thank you for your feedback.')}”</p><div class="feedback-review-action"><b>${entry.approved?'Published':'Pending'}</b><button type="button" data-feedback-moderate="${entry.id}" data-approved="${entry.approved?'0':'1'}">${entry.approved?'Hide':'Publish'}</button></div></article>`).join(''):'<p class="empty-admin-state">No customer feedback yet.</p>';
  container.querySelectorAll('[data-feedback-moderate]').forEach(button=>button.onclick=async()=>{const approved=button.dataset.approved==='1';button.disabled=true;button.textContent=approved?'Publishing…':'Hiding…';try{await YG_api(`/api/admin-feedback/${button.dataset.feedbackModerate}`,{method:'PATCH',body:JSON.stringify({approved})});toast(approved?'Feedback published':'Feedback hidden from the storefront');await loadFeedback();}catch(error){button.disabled=false;button.textContent=approved?'Publish':'Hide';toast(error.message);}});
}
function renderInventoryPie(){
  const pie=$('#inventoryPie'),legend=$('#inventoryPieLegend');
  if(!pie||!legend)return;
  const palette=['#8f5d3e','#c18b5f','#dfb98f','#7f8165','#b6aa83','#d8c7ad'];
  const ranked=products.map(product=>({name:product.name,stock:Math.max(0,Number(product.stock||0))})).filter(product=>product.stock>0).sort((a,b)=>b.stock-a.stock);
  const visible=ranked.slice(0,5),other=ranked.slice(5).reduce((sum,product)=>sum+product.stock,0);
  if(other>0)visible.push({name:'Other products',stock:other});
  const total=visible.reduce((sum,product)=>sum+product.stock,0);
  let cursor=0;
  const segments=visible.map((product,index)=>{const start=cursor,end=cursor+(total?product.stock/total*100:0);cursor=end;return `${palette[index%palette.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;});
  pie.style.background=segments.length?`conic-gradient(${segments.join(',')})`:'#eee7df';
  pie.setAttribute('aria-label',total?`Inventory distribution for ${total} units`:'No inventory available');
  $('#dashboardStockUnits').textContent=total;
  legend.innerHTML=visible.length?visible.map((product,index)=>`<div><i style="--legend-color:${palette[index%palette.length]}"></i><span>${escapeHtml(product.name)}</span><b>${product.stock}</b></div>`).join(''):'<p class="empty-admin-state">No stock available.</p>';
}
function renderSalesChart(){
  const select=$('.sales-panel select'),days=select?.value.includes('30')?30:7,end=new Date();end.setHours(23,59,59,999);
  const points=Array.from({length:days},(_,offset)=>{const date=new Date(end);date.setDate(end.getDate()-(days-1-offset));date.setHours(0,0,0,0);const next=new Date(date);next.setDate(date.getDate()+1);const total=verifiedRevenue(orders.filter(order=>{const placed=orderDate(order);return placed&&placed>=date&&placed<next;}));return{date,total};});
  const maximum=Math.max(...points.map(point=>point.total),0),axisMaximum=maximum?Math.ceil(maximum/1000)*1000:1000;
  const labels=$('.chart-labels');labels.innerHTML=`<span>${money(axisMaximum)}</span><span>${money(axisMaximum*.67)}</span><span>${money(axisMaximum*.33)}</span><span>${money(0)}</span>`;
  $('.bars').innerHTML=points.map((point,index)=>`<i style="height:${point.total?Math.max(6,Math.round(point.total/axisMaximum*100)):2}%" title="${point.date.toLocaleDateString('en-PH',{month:'short',day:'numeric'})}: ${money(point.total)}"><b>${days===7?point.date.toLocaleDateString('en-PH',{weekday:'short'}):(index%5===0||index===days-1?point.date.toLocaleDateString('en-PH',{month:'short',day:'numeric'}):'')}</b></i>`).join('');
  $('.sales-panel .eyebrow').textContent=`${money(points.reduce((sum,point)=>sum+point.total,0))} verified sales`;
}
function renderReports(){
  const fromValue=$('#reportDateFrom').value,toValue=$('#reportDateTo').value,from=fromValue?new Date(`${fromValue}T00:00:00`):null,to=toValue?new Date(`${toValue}T23:59:59`):null,inRange=date=>date&&(!from||date>=from)&&(!to||date<=to);
  const filteredOrders=orders.filter(order=>inRange(orderDate(order))),completedOrders=orders.filter(order=>{const completedDate=new Date(order.completedAt||order.date);return (order.workflowStatus==='completed'||order.deliveryStatus==='delivered')&&order.paymentStatus==='verified'&&inRange(Number.isNaN(completedDate.getTime())?null:completedDate);}),sales=completedOrders.reduce((sum,order)=>sum+Math.max(0,Number(order.subtotal||0)-Number(order.discountAmount||0)),0),totalUnits=products.reduce((sum,product)=>sum+Math.max(0,Number(product.stock||0)),0);
  const dateLabel=from||to?`${from?from.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'Beginning'} – ${to?to.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}):'Present'}`:'All recorded dates';
  $('#reportTotalSales').textContent=money(sales);$('#reportProductCount').textContent=products.length;$('#reportStockCount').textContent=`${totalUnits} total inventory unit${totalUnits===1?'':'s'}`;$('#reportOrderCount').textContent=filteredOrders.length;$('#reportVerifiedOrderCount').textContent=completedOrders.length;$('#reportDateLabel').textContent=dateLabel;
  $('#reportSalesRows').innerHTML=completedOrders.length?completedOrders.map(order=>{const productNames=(order.items||[]).map(item=>`${item.name} ×${item.quantity}`).join(', ')||'No item details',productSales=Math.max(0,Number(order.subtotal||0)-Number(order.discountAmount||0));return `<tr><td><strong>${escapeHtml(order.number)}</strong></td><td>${escapeHtml(order.customer||'Guest')}</td><td>${escapeHtml(productNames)}</td><td>${escapeHtml(order.completedTime||order.date||'—')}</td><td><strong>${money(productSales)}</strong></td></tr>`;}).join(''):'<tr><td colspan="5">No completed orders found within this date range.</td></tr>';
  $('#reportOrderRows').innerHTML=filteredOrders.length?filteredOrders.map(order=>{const productNames=(order.items||[]).map(item=>`${item.name} ×${item.quantity}`).join(', ')||'No item details';const productSales=Math.max(0,Number(order.subtotal||0)-Number(order.discountAmount||0));return `<tr><td><strong>${escapeHtml(order.number)}</strong></td><td>${escapeHtml(order.customer||'Guest')}</td><td>${escapeHtml(productNames)}</td><td>${escapeHtml(order.date||'—')}</td><td>${money(productSales)}</td><td>${escapeHtml(order.status||'Pending')}</td></tr>`;}).join(''):'<tr><td colspan="6">No orders found within this date range.</td></tr>';
  const inventory=[...products].sort((a,b)=>a.name.localeCompare(b.name));
  $('#reportInventoryRows').innerHTML=inventory.length?inventory.map(product=>{const quantity=Math.max(0,Number(product.stock||0)),status=quantity===0?'Out of stock':quantity<=5?'Low stock':'Healthy';return `<tr><td><strong>${escapeHtml(product.name)}</strong></td><td>${escapeHtml(product.batch||'—')}</td><td>${quantity}</td><td><span class="report-stock-status ${quantity<=5?'warning':''}">${status}</span></td></tr>`;}).join(''):'<tr><td colspan="4">No inventory records available.</td></tr>';
  const today=new Date();today.setHours(0,0,0,0);const expiryProducts=products.filter(product=>product.expiry&&inRange(new Date(`${product.expiry}T00:00:00`))).sort((a,b)=>a.expiry.localeCompare(b.expiry));
  $('#reportExpiryRows').innerHTML=expiryProducts.length?expiryProducts.map(product=>{const expiry=new Date(`${product.expiry}T00:00:00`),days=Math.ceil((expiry-today)/86400000),remaining=days<0?`${Math.abs(days)} day${Math.abs(days)===1?'':'s'} expired`:days===0?'Expires today':`${days} day${days===1?'':'s'}`;return `<tr><td><strong>${escapeHtml(product.name)}</strong></td><td>${escapeHtml(product.batch||'—')}</td><td>${escapeHtml(product.expiry)}</td><td><span class="report-expiry-status ${days<=30?'warning':''}">${remaining}</span></td></tr>`;}).join(''):'<tr><td colspan="4">No expiry records found within this date range.</td></tr>';
  $('#reportSalesCount').textContent=completedOrders.length;$('#reportOrdersCount').textContent=filteredOrders.length;$('#reportInventoryCount').textContent=inventory.length;$('#reportExpiryCount').textContent=expiryProducts.length;
  $('#reportPrintTitle').textContent=`${activeReportFolder.charAt(0).toUpperCase()+activeReportFolder.slice(1)} report`;$('#reportPrintRange').textContent=activeReportFolder==='inventory'?'Current inventory snapshot':dateLabel;
  document.querySelectorAll('[data-report-folder]').forEach(button=>button.classList.toggle('active',button.dataset.reportFolder===activeReportFolder));document.querySelectorAll('[data-report-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.reportPanel===activeReportFolder));
}
function renderMetrics(){
  const newOrders=orders.filter(order=>order.deliveryStatus==='pending').length;
  const lowStockThreshold=5;
  const inventoryProducts=[...products].sort((a,b)=>Number(a.stock)-Number(b.stock)||a.name.localeCompare(b.name));
  inventoryStockPage=Math.min(inventoryStockPage,Math.max(1,Math.ceil(inventoryProducts.length/adminItemsPerPage)));
  const stockMarkup=inventoryProducts.length
    ?inventoryProducts.slice((inventoryStockPage-1)*adminItemsPerPage,inventoryStockPage*adminItemsPerPage).map(product=>{const quantity=Math.max(0,Number(product.stock||0)),isLow=quantity<=lowStockThreshold,isOut=quantity===0;return `<div class="stock-row ${isLow?'is-low-stock':''} ${isOut?'is-out-of-stock':''}"><i>${escapeHtml(product.short)}</i><div><h3>${escapeHtml(product.name)}</h3><p>Batch ${escapeHtml(product.batch||'—')}${isOut?' · Out of stock':isLow?' · Reorder recommended':' · Stock level healthy'}</p></div><span class="stock-quantity"><strong>${quantity}</strong><small>unit${quantity===1?'':'s'}</small></span>${isLow?`<b>${isOut?'Out of stock':'Low stock'}</b>`:''}</div>`;}).join('')
    :'<p class="empty-admin-state">No inventory products available.</p>';
  $('#pendingBadge').textContent=newOrders;
  $('#pendingBadge').hidden=newOrders===0;
  const today=new Date(),monthStart=new Date(today.getFullYear(),today.getMonth(),1),dayStart=new Date(today.getFullYear(),today.getMonth(),today.getDate()),nextDay=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
  const ordersToday=orders.filter(order=>{const placed=orderDate(order);return placed&&placed>=dayStart&&placed<nextDay;}).length;
  const ordersMonth=orders.filter(order=>{const placed=orderDate(order);return placed&&placed>=monthStart&&placed<nextDay;}).length;
  const soldByProduct=new Map();
  orders.filter(order=>order.paymentStatus==='verified'&&order.deliveryStatus!=='cancelled').forEach(order=>(order.items||[]).forEach(item=>soldByProduct.set(item.name,(soldByProduct.get(item.name)||0)+Number(item.quantity||0))));
  const topProduct=[...soldByProduct.entries()].sort((a,b)=>b[1]-a[1])[0];
  const activeCustomers=new Set(orders.filter(order=>order.deliveryStatus!=='cancelled').map(order=>order.userId).filter(Boolean)).size;
  $('#orderCount').textContent=orders.length;
  $('#ordersToday').textContent=ordersToday;
  $('#ordersMonth').textContent=ordersMonth;
  $('#topSellingProduct').textContent=topProduct?.[0]||'—';
  $('#topSellingProductUnits').textContent=topProduct?`${topProduct[1]} unit${topProduct[1]===1?'':'s'} sold from verified orders`:'No verified product sales yet';
  $('#activeCustomerCount').textContent=activeCustomers;
  $('#revenue').textContent=money(verifiedRevenue());
  renderInventoryPie();
  $('#inventoryStockAlerts').innerHTML=stockMarkup;
  renderListPagination('inventoryStockPagination',inventoryProducts.length,inventoryStockPage,page=>{inventoryStockPage=page;renderMetrics();});
  renderSalesChart();
  renderDashboardFeedback();
  renderReports();
}
function renderExpiry(){const today=new Date(),expiryProducts=products.filter(product=>product.expiry).sort((a,b)=>a.expiry.localeCompare(b.expiry));inventoryExpiryPage=Math.min(inventoryExpiryPage,Math.max(1,Math.ceil(expiryProducts.length/adminItemsPerPage)));$('#expiryRows').innerHTML=expiryProducts.slice((inventoryExpiryPage-1)*adminItemsPerPage,inventoryExpiryPage*adminItemsPerPage).map(product=>{const days=Math.ceil((new Date(product.expiry)-today)/86400000);return `<div class="expiry-row"><div><h3>${product.name}</h3><p>Batch ${product.batch} · ${product.stock} units</p></div><b>${days} days</b></div>`;}).join('')||'<p class="empty-admin-state">No expiry records.</p>';renderListPagination('inventoryExpiryPagination',expiryProducts.length,inventoryExpiryPage,page=>{inventoryExpiryPage=page;renderExpiry();});}
function renderProducts(){
  const active=products.filter(product=>product.isActive!==false);
  const totalPages=Math.max(1,Math.ceil(products.length/productsPerPage));
  productPage=Math.min(Math.max(1,productPage),totalPages);
  const pageStart=(productPage-1)*productsPerPage;
  const visibleProducts=products.slice(pageStart,pageStart+productsPerPage);
  $('#activeProductCount').textContent=active.length;$('#draftProductCount').textContent=products.length-active.length;
  $('#productAdminGrid').innerHTML=products.length?visibleProducts.map(product=>{const artwork=adminCollectionArtwork(product);const expiryMeta=product.expiry?` · expires ${product.expiry}`:'';return `<article class="admin-product-card ${product.isActive===false?'is-hidden':''}"><div class="admin-product-visual ${product.tone}">${artwork?`<img src="${escapeHtml(artwork)}" alt="${escapeHtml(product.name)}">`:`<span>${escapeHtml(product.short)}</span>`}<b>${product.isActive===false?'Hidden':'Live'}</b></div><div class="admin-product-info"><p>${product.category}</p><h3>${product.name}</h3><div class="admin-product-meta"><span>${money(product.price)}</span></div><small>SKU ${product.sku} · Batch ${product.batch}${expiryMeta}</small></div><div class="admin-product-controls"><label class="catalog-switch"><input type="checkbox" data-toggle-product="${product.id}" ${product.isActive!==false?'checked':''}><i></i><span>${product.isActive!==false?'Visible':'Hidden'}</span></label><button data-edit-product="${product.id}">Edit</button><button class="danger-link" data-delete-product="${product.id}">Delete</button></div></article>`;}).join(''):'<div class="empty-product-manager"><h3>No products yet</h3><p>Add your first product to begin building the storefront catalog.</p></div>';
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
$('#productForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,data=new FormData(form),existingId=data.get('id'),button=form.querySelector('[type="submit"]');data.set('name',data.get('name').trim());data.set('category',data.get('category').trim());data.set('sku',existingId?products.find(item=>item.id===existingId)?.sku||'':'');data.set('batch',data.get('batch').trim().toUpperCase());data.set('benefit',data.get('benefit').trim());data.set('isActive',form.elements.isActive.checked?'1':'0');data.set('remove_image',form.elements.remove_image.checked?'1':'0');if(existingId)data.set('_method','PUT');button.disabled=true;button.textContent='Uploading…';try{const saved=await YG_api(existingId?`/api/products/${existingId}`:'/api/products',{method:'POST',body:data});products=existingId?products.map(item=>item.id===existingId?saved:item):[saved,...products];if(!existingId)productPage=1;closeProductModal();refreshProducts(`${saved.name} saved to MySQL`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Save product';}};
function orderFolderLabel(status){return {pending:'Pending',packing:'Packing',in_transit:'In Transit',delivered:'Delivered',cancelled:'Cancelled',archived:'Archived'}[status]||status;}
function orderWorkflowControls(order){const canDelete=order.deliveryStatus==='cancelled'||order.isArchived;return `<div class="order-actions-menu"><button type="button" class="order-actions-trigger" data-order-actions="${order.id}" aria-label="Actions for order ${escapeHtml(order.number)}" aria-expanded="false"><span aria-hidden="true">⋯</span></button><div class="order-actions-popover" data-order-actions-menu="${order.id}" hidden><button type="button" data-review-message="${order.userId}">Open transaction</button><button type="button" data-archive-order="${order.id}" data-archive-value="${order.isArchived?'0':'1'}">${order.isArchived?'Restore order':'Archive order'}</button>${canDelete?`<button type="button" class="delete-order-action" data-delete-order="${order.id}" data-order-number="${escapeHtml(order.number)}">Delete permanently</button>`:''}</div></div>`;}
function renderOrders(){
  const folderOrders=orders.filter(order=>activeOrderFolder==='archived'?order.isArchived:!order.isArchived&&order.deliveryStatus===activeOrderFolder);
  orderPage=Math.min(orderPage,Math.max(1,Math.ceil(folderOrders.length/adminItemsPerPage)));
  const visibleOrders=folderOrders.slice((orderPage-1)*adminItemsPerPage,orderPage*adminItemsPerPage);
  document.querySelectorAll('[data-order-folder]').forEach(button=>{
    const status=button.dataset.orderFolder;
    button.classList.toggle('active',status===activeOrderFolder);
    button.setAttribute('aria-current',status===activeOrderFolder?'page':'false');
    button.querySelector('b').textContent=orders.filter(order=>status==='archived'?order.isArchived:!order.isArchived&&order.deliveryStatus===status).length;
    button.onclick=()=>{activeOrderFolder=status;orderPage=1;renderOrders();};
  });
  $('#orderRows').innerHTML=folderOrders.length?visibleOrders.map(order=>`<tr class="admin-order-summary-row"><td><strong>${order.number}</strong><button type="button" class="admin-view-order" data-admin-order-toggle="${order.id}" aria-expanded="false">View details</button></td><td>${escapeHtml(order.customer||'Guest')}</td><td>${order.date}</td><td>${escapeHtml(order.payment||'Not selected')}</td><td>${money(order.total)}</td><td><span class="status ${order.status.toLowerCase().replaceAll(' ','-')}">${order.status}</span></td><td>${orderWorkflowControls(order)}</td></tr><tr class="admin-order-module-detail" data-admin-order-detail="${order.id}" hidden><td colspan="7">${adminOrderModuleDetails(order)}</td></tr>`).join(''):`<tr class="order-empty"><td colspan="7">No ${orderFolderLabel(activeOrderFolder).toLowerCase()} orders.</td></tr>`;
  renderListPagination('orderPagination',folderOrders.length,orderPage,page=>{orderPage=page;renderOrders();});
  document.querySelectorAll('[data-order-status]').forEach(select=>select.onchange=async()=>{const destination=select.value;select.disabled=true;try{await YG_api(`/api/orders/${select.dataset.orderStatus}`,{method:'PATCH',body:JSON.stringify({delivery_status:destination,payment_status:destination==='delivered'?'verified':undefined})});await loadOrders();toast(`Order moved to ${orderFolderLabel(destination)}`);}catch(error){select.disabled=false;toast(error.message);}});
  document.querySelectorAll('[data-review-message]').forEach(button=>button.onclick=async()=>{openModule('messages');await selectClient(Number(button.dataset.reviewMessage));});
  document.querySelectorAll('[data-order-actions]').forEach(button=>button.onclick=event=>{event.stopPropagation();const menu=document.querySelector(`[data-order-actions-menu="${button.dataset.orderActions}"]`);document.querySelectorAll('[data-order-actions-menu]').forEach(item=>{if(item!==menu)item.hidden=true;});menu.hidden=!menu.hidden;button.setAttribute('aria-expanded',String(!menu.hidden));});
  document.querySelectorAll('[data-archive-order]').forEach(button=>button.onclick=async()=>{const archive=button.dataset.archiveValue==='1';if(archive&&!await YG_confirm({title:'Archive this order?',message:'The order will move to the Archived folder. It can be restored later.',confirmText:'Archive order'}))return;button.disabled=true;try{await YG_api(`/api/orders/${button.dataset.archiveOrder}`,{method:'PATCH',body:JSON.stringify({archived:archive})});await loadOrders();toast(archive?'Order moved to Archived':'Order restored to its status folder');}catch(error){button.disabled=false;toast(error.message);}});
  document.querySelectorAll('[data-delete-order]').forEach(button=>button.onclick=async()=>{if(!await YG_confirm({title:`Delete ${button.dataset.orderNumber} permanently?`,message:'This permanently removes the order, its product records, and any uploaded payment receipt. This action cannot be undone.',confirmText:'Delete permanently'}))return;button.disabled=true;try{await YG_api(`/api/orders/${button.dataset.deleteOrder}`,{method:'DELETE'});await loadOrders();toast('Order permanently deleted');}catch(error){button.disabled=false;toast(error.message);}});
  document.querySelectorAll('[data-admin-order-toggle]').forEach(button=>button.onclick=()=>{const row=document.querySelector(`[data-admin-order-detail="${button.dataset.adminOrderToggle}"]`);const open=row.hidden;row.hidden=!open;button.setAttribute('aria-expanded',String(open));button.textContent=open?'Hide details':'View details';});
  document.querySelectorAll('[data-confirm-shipping]').forEach(button=>button.onclick=async()=>{const input=document.querySelector(`[data-shipping-fee="${button.dataset.confirmShipping}"]`);button.disabled=true;try{await YG_api(`/api/orders/${button.dataset.confirmShipping}`,{method:'PATCH',body:JSON.stringify({shipping_amount:Number(input.value)})});await loadOrders();toast('Delivery fee confirmed. Customer can now verify the address.');}catch(error){button.disabled=false;toast(error.message);}});
  document.querySelectorAll('[data-verify-payment]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await YG_api(`/api/orders/${button.dataset.verifyPayment}`,{method:'PATCH',body:JSON.stringify({payment_status:'verified',workflow_status:'ready_for_fulfillment'})});await loadOrders();toast('Payment verified');}catch(error){button.disabled=false;toast(error.message);}});
}
document.addEventListener('click',event=>{if(event.target.closest('.order-actions-menu'))return;document.querySelectorAll('[data-order-actions-menu]').forEach(menu=>menu.hidden=true);document.querySelectorAll('[data-order-actions]').forEach(button=>button.setAttribute('aria-expanded','false'));});
async function loadOrders(){try{orders=await YG_api('/api/orders');renderOrders();renderMetrics();}catch(error){toast(error.message);}}
async function loadFeedback(){try{feedback=await YG_api('/api/admin-feedback');renderDashboardFeedback();}catch(error){feedback=[];renderDashboardFeedback();}}
function updateInboxBadges(){const unread=clients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);['#inboxBadge','#floatingMessageBadge'].forEach(selector=>{const badge=$(selector);badge.textContent=unread;badge.hidden=unread===0;});}
function openCustomerModal(){$('#customerForm').reset();$('#customerModal').classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>$('#customerForm').elements.name.focus(),50);}
function closeCustomerModal(){$('#customerModal').classList.remove('open');document.body.style.overflow='';}
$('#addCustomer').onclick=openCustomerModal;$('#closeCustomerModal').onclick=closeCustomerModal;$('#cancelCustomer').onclick=closeCustomerModal;$('#customerModal').onclick=event=>{if(event.target===$('#customerModal'))closeCustomerModal();};
$('#customerForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=new FormData(form);if(data.get('password')!==data.get('password_confirmation'))return toast('Passwords do not match');const payload={name:data.get('name').trim(),email:data.get('email').trim().toLowerCase(),phone:data.get('phone').trim(),address:data.get('address').trim(),password:data.get('password'),password_confirmation:data.get('password_confirmation'),marketing_consent:data.get('marketing_consent')==='on'};button.disabled=true;button.textContent='Creating…';try{const created=await YG_api('/api/clients',{method:'POST',body:JSON.stringify(payload)});closeCustomerModal();await loadClients();await selectClient(created.userId);toast(`${created.name} added as a customer`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Create customer';}};
function renderAdministrators(){administratorPage=Math.min(administratorPage,Math.max(1,Math.ceil(administrators.length/adminItemsPerPage)));const visible=administrators.slice((administratorPage-1)*adminItemsPerPage,administratorPage*adminItemsPerPage);$('#administratorList').innerHTML=administrators.length?visible.map(admin=>`<article class="admin-user-row"><span>${escapeHtml(admin.name.split(' ').map(part=>part[0]).slice(0,2).join(''))}</span><div><strong>${escapeHtml(admin.name)}</strong><small>${escapeHtml(admin.email)}${admin.phone?` · ${escapeHtml(admin.phone)}`:''}</small></div><time>Added ${admin.createdAt}</time><b>${admin.isCurrent?'Current account':'Administrator'}</b><button type="button" data-edit-administrator="${admin.id}">Edit</button></article>`).join(''):'<p class="empty-admin-state">No administrator accounts found.</p>';renderListPagination('administratorPagination',administrators.length,administratorPage,page=>{administratorPage=page;renderAdministrators();});document.querySelectorAll('[data-edit-administrator]').forEach(button=>button.onclick=()=>openAdministratorModal(administrators.find(admin=>admin.id===Number(button.dataset.editAdministrator))));}
async function loadAdministrators(){try{administrators=await YG_api('/api/admins');renderAdministrators();}catch(error){toast(error.message);}}
function renderPaymentSettings(){$('#paymentSettings').innerHTML=paymentMethods.map(method=>`<form class="payment-setting-card" data-payment-method="${method.id}"><div class="payment-setting-head"><div><span>${escapeHtml(method.code.replaceAll('_',' '))}</span><h3>${escapeHtml(method.name)}</h3></div><label class="catalog-switch"><input type="checkbox" name="is_active" ${method.isActive?'checked':''}><i></i><span>Displayed at checkout</span></label></div><div class="payment-setting-grid"><label>Display name<input required name="name" value="${escapeHtml(method.name)}"></label><label>Bank or wallet<input name="bank_name" value="${escapeHtml(method.bankName||'')}" placeholder="e.g. GCash or BDO"></label><label>Account name<input name="account_name" value="${escapeHtml(method.accountName||'')}" placeholder="Account holder"></label><label>Account number<input name="account_number" value="${escapeHtml(method.accountNumber||'')}" placeholder="Account or mobile number"></label><label class="wide">Customer instructions<textarea name="instructions" placeholder="Instructions shown during checkout">${escapeHtml(method.instructions||'')}</textarea></label><label class="payment-qr-upload">QR code<input type="file" name="qr" accept="image/png,image/jpeg,image/webp">${method.qrUrl?`<img src="${method.qrUrl}" alt="${escapeHtml(method.name)} QR code"><span><input type="checkbox" name="remove_qr"> Remove current QR</span>`:'<small>Upload PNG, JPG, or WebP up to 5 MB.</small>'}</label><label class="product-active-field"><input type="checkbox" name="requires_receipt" ${method.requiresReceipt?'checked':''}><span><b>Require payment receipt</b><small>Customers must upload proof before placing the order.</small></span></label></div><button class="primary-action" type="submit">Save ${escapeHtml(method.name)}</button></form>`).join('')||'<p class="empty-admin-state">No payment methods configured.</p>';document.querySelectorAll('[data-payment-method]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]'),data=new FormData(form);data.set('is_active',form.elements.is_active.checked?'1':'0');data.set('requires_receipt',form.elements.requires_receipt.checked?'1':'0');data.set('remove_qr',form.elements.remove_qr?.checked?'1':'0');button.disabled=true;button.textContent='Saving…';try{await YG_api(`/api/payment-methods/${form.dataset.paymentMethod}`,{method:'POST',body:data});await loadPaymentMethods();toast('Payment method updated');}catch(error){toast(error.message);}finally{button.disabled=false;}});}
async function loadPaymentMethods(){try{paymentMethods=await YG_api('/api/payment-methods');renderPaymentSettings();}catch(error){toast(error.message);}}
function discountValue(discount){return discount.type==='percentage'?`${Number(discount.value)}%`:money(discount.value);}
function renderDiscounts(){
  const list=$('#discountList');if(!list)return;
  list.innerHTML=discounts.length?discounts.map(discount=>`<article class="discount-row ${discount.isActive?'':'is-inactive'}"><div class="discount-code"><span>${escapeHtml(discount.code)}</span><small>${discount.isActive?'Active':'Inactive'}</small></div><div class="discount-details"><h3>${escapeHtml(discount.name)}</h3><p>${discountValue(discount)} off${Number(discount.minimumOrderValue)>0?` · Minimum order ${money(discount.minimumOrderValue)}`:''}${discount.expiresAt?` · Expires ${escapeHtml(discount.expiresAt)}`:' · No expiry'}</p><div class="discount-assignees">${discount.customers.map(customer=>`<span>${escapeHtml(customer.name)}</span>`).join('')}</div></div><div class="discount-row-actions"><button type="button" data-edit-discount="${discount.id}">Edit</button><button type="button" class="danger-link" data-delete-discount="${discount.id}">Delete</button></div></article>`).join(''):'<div class="empty-product-manager"><h3>No discounts yet</h3><p>Add a discount and assign it to one or more registered customers.</p></div>';
  list.querySelectorAll('[data-edit-discount]').forEach(button=>button.onclick=()=>openDiscountModal(discounts.find(item=>Number(item.id)===Number(button.dataset.editDiscount))));
  list.querySelectorAll('[data-delete-discount]').forEach(button=>button.onclick=async()=>{const discount=discounts.find(item=>Number(item.id)===Number(button.dataset.deleteDiscount));if(!await YG_confirm({title:`Delete ${discount.code}?`,message:'This permanently removes the discount and all customer assignments.',confirmText:'Delete discount'}))return;try{await YG_api(`/api/discounts/${discount.id}`,{method:'DELETE'});discounts=discounts.filter(item=>item.id!==discount.id);renderDiscounts();toast('Discount deleted');}catch(error){toast(error.message);}});
}
async function loadDiscounts(){try{discounts=await YG_api('/api/discounts');renderDiscounts();}catch(error){toast(error.message);}}
function updateDiscountCustomerSummary(){const inputs=[...document.querySelectorAll('#discountCustomerList [name="customer_ids"]')],selected=inputs.filter(input=>input.checked),all=$('#discountSelectAll');all.checked=inputs.length>0&&selected.length===inputs.length;all.indeterminate=selected.length>0&&selected.length<inputs.length;$('#discountCustomerSummary').textContent=selected.length===0?'Select customers':selected.length===inputs.length?`All customers selected (${selected.length})`:`${selected.length} customer${selected.length===1?'':'s'} selected`;}
function renderDiscountCustomers(selected=[]){const selectedIds=new Set(selected.map(Number));$('#discountCustomerList').innerHTML=clients.length?clients.map(client=>`<label><input type="checkbox" name="customer_ids" value="${client.userId}" ${selectedIds.has(Number(client.userId))?'checked':''}><span><b>${escapeHtml(client.name)}</b></span></label>`).join(''):'<p>No registered customers available. Add a customer first.</p>';document.querySelectorAll('#discountCustomerList [name="customer_ids"]').forEach(input=>input.onchange=updateDiscountCustomerSummary);$('#discountSelectAll').onchange=event=>{document.querySelectorAll('#discountCustomerList [name="customer_ids"]').forEach(input=>input.checked=event.target.checked);updateDiscountCustomerSummary();};updateDiscountCustomerSummary();}
function openDiscountModal(discount=null){const form=$('#discountForm');form.reset();$('#discountCustomerSelect').open=false;form.elements.id.value=discount?.id||'';form.elements.name.value=discount?.name||'';form.elements.code.value=discount?.code||'';form.elements.type.value=discount?.type||'percentage';form.elements.value.value=discount?.value||'';form.elements.minimum_order_value.value=discount?.minimumOrderValue||0;form.elements.expires_at.value=discount?.expiresAt||'';form.elements.is_active.checked=discount?.isActive!==false;renderDiscountCustomers(discount?.customers?.map(customer=>customer.id)||[]);$('#discountModalTitle').textContent=discount?'Edit discount':'Add discount';$('#discountModal').classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>form.elements.name.focus(),50);}
function closeDiscountModal(){$('#discountModal').classList.remove('open');document.body.style.overflow='';}
$('#addDiscount').onclick=()=>openDiscountModal();$('#closeDiscountModal').onclick=closeDiscountModal;$('#cancelDiscount').onclick=closeDiscountModal;$('#discountModal').onclick=event=>{if(event.target===$('#discountModal'))closeDiscountModal();};
$('#discountForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,id=form.elements.id.value,customerIds=[...form.querySelectorAll('[name="customer_ids"]:checked')].map(input=>Number(input.value)),button=form.querySelector('[type="submit"]');if(!customerIds.length)return toast('Select at least one customer');const payload={name:form.elements.name.value.trim(),code:form.elements.code.value.trim().toUpperCase(),type:form.elements.type.value,value:Number(form.elements.value.value),minimum_order_value:Number(form.elements.minimum_order_value.value||0),expires_at:form.elements.expires_at.value||null,is_active:form.elements.is_active.checked,customer_ids:customerIds};button.disabled=true;button.textContent='Saving…';try{const saved=await YG_api(id?`/api/discounts/${id}`:'/api/discounts',{method:id?'PUT':'POST',body:JSON.stringify(payload)});discounts=id?discounts.map(item=>Number(item.id)===Number(id)?saved:item):[saved,...discounts];closeDiscountModal();renderDiscounts();toast(`${saved.code} saved and assigned`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent='Save discount';}};
function openAdministratorModal(admin=null){const form=$('#administratorForm');form.reset();form.elements.id.value=admin?.id||'';form.elements.name.value=admin?.name||'';form.elements.email.value=admin?.email||'';form.elements.phone.value=admin?.phone||'';form.elements.password.required=!admin;form.elements.password_confirmation.required=!admin;$('#administratorModalTitle').textContent=admin?'Edit administrator':'Add administrator';$('#administratorPasswordLabel').textContent=admin?'New password (optional)':'Password';$('#administratorConfirmationLabel').textContent=admin?'Confirm new password':'Confirm password';form.querySelector('[type="submit"]').textContent=admin?'Save changes':'Create administrator';$('#administratorModal').classList.add('open');document.body.style.overflow='hidden';setTimeout(()=>form.elements.name.focus(),50);}
function closeAdministratorModal(){$('#administratorModal').classList.remove('open');document.body.style.overflow='';}
$('#addAdministrator').onclick=openAdministratorModal;$('#closeAdministratorModal').onclick=closeAdministratorModal;$('#cancelAdministrator').onclick=closeAdministratorModal;$('#administratorModal').onclick=event=>{if(event.target===$('#administratorModal'))closeAdministratorModal();};
$('#administratorForm').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),data=new FormData(form),adminId=data.get('id'),password=data.get('password');if(password!==data.get('password_confirmation'))return toast('Passwords do not match');const payload={name:data.get('name').trim(),email:data.get('email').trim().toLowerCase(),phone:data.get('phone').trim(),password,password_confirmation:data.get('password_confirmation')};button.disabled=true;button.textContent='Saving…';try{const saved=await YG_api(adminId?`/api/admins/${adminId}`:'/api/admins',{method:adminId?'PUT':'POST',body:JSON.stringify(payload)});closeAdministratorModal();await loadAdministrators();toast(adminId?`${saved.name} updated`:`${saved.name} added as an administrator`);}catch(error){toast(error.message);}finally{button.disabled=false;button.textContent=adminId?'Save changes':'Create administrator';}};
function renderClients(){updateInboxBadges();const directory=$('#customerDirectory'),inbox=$('#clientListRows'),query=messageClientQuery.trim().toLowerCase(),matchedClients=query?clients.filter(client=>[client.name,client.email,client.phone].some(value=>String(value||'').toLowerCase().includes(query))):clients;customerPage=Math.min(customerPage,Math.max(1,Math.ceil(clients.length/adminItemsPerPage)));if(!clients.length){directory.innerHTML='<p class="empty-admin-state">No registered customers yet.</p>';inbox.innerHTML='<p class="client-search-empty">No customer conversations yet.</p>';renderListPagination('customerPagination',0,1,()=>{});return;}const visibleCustomers=clients.slice((customerPage-1)*adminItemsPerPage,customerPage*adminItemsPerPage);directory.innerHTML=visibleCustomers.map(client=>`<article class="customer-directory-row"><span>${escapeHtml(client.name.split(' ').map(part=>part[0]).slice(0,2).join(''))}</span><div><strong>${escapeHtml(client.name)}</strong><small>${escapeHtml(client.email)} · ${escapeHtml(client.phone||'No phone saved')}</small></div><div><small>Customer type</small><b>${escapeHtml(client.segment)}</b></div><div><small>Completed orders</small><b>${client.completedOrders}</b></div><div><small>Lifetime spend</small><b>${money(client.totalSpend)}</b></div><div><small>Eligible offer</small><b>${escapeHtml(client.offer)}</b></div><button type="button" data-customer-message="${client.userId}">Message${client.unreadMessages?` (${client.unreadMessages})`:''}</button></article>`).join('');inbox.innerHTML=matchedClients.length?matchedClients.map(client=>`<button class="client-card ${client===selectedClient?'active':''}" data-client="${client.userId}"><span>${client.name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span><div><strong>${escapeHtml(client.name)}</strong><small>${client.segment} client</small></div>${client.unreadMessages?`<b>${client.unreadMessages} new</b>`:''}</button>`).join(''):'<p class="client-search-empty">No conversations match your search.</p>';renderListPagination('customerPagination',clients.length,customerPage,page=>{customerPage=page;renderClients();});document.querySelectorAll('[data-client]').forEach(button=>button.onclick=()=>selectClient(Number(button.dataset.client)));document.querySelectorAll('[data-customer-message]').forEach(button=>button.onclick=async()=>{openModule('messages');await selectClient(Number(button.dataset.customerMessage));});}
$('#messageClientSearch').addEventListener('input',event=>{messageClientQuery=event.target.value;renderClients();});
async function selectClient(userId){selectedClient=clients.find(c=>c.userId===userId);renderClients();$('#clientInitials').textContent=selectedClient.name.split(' ').map(p=>p[0]).slice(0,2).join('');$('#clientName').textContent=selectedClient.name;$('#clientContact').textContent=`${selectedClient.email} · ${selectedClient.phone||'No phone saved'}`;$('#clientSegment').textContent=selectedClient.segment;$('#clientOrders').textContent=selectedClient.completedOrders;$('#clientSpend').textContent=money(selectedClient.totalSpend);$('#clientOffer').textContent=selectedClient.offer;await renderAdminMessages();}
async function loadClients(autoOpenNew=false){try{const selectedId=selectedClient?.userId;const updatedClients=await YG_api('/api/clients');const unreadCount=updatedClients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);const hasNewMessage=autoOpenNew&&unreadCount>knownUnreadCount;clients=updatedClients;selectedClient=clients.find(client=>client.userId===selectedId)||clients[0]||null;knownUnreadCount=unreadCount;if(hasNewMessage){selectedClient=clients.find(client=>client.unreadMessages>0)||selectedClient;}renderClients();if(hasNewMessage&&selectedClient){toggleFloatingMessages(true);toast(`New message from ${selectedClient.name}`);}}catch(error){toast(error.message);}}
function renderFloatingMessages(list=[]){
  $('#floatingClientName').textContent=selectedClient?selectedClient.name:'Messages';
  $('#floatingMessageThread').innerHTML=list.length?list.map(message=>`<div class="floating-bubble ${message.from==='support'?'support':''}">${renderMessageBody(message)}<small>${escapeHtml(message.time)}</small></div>`).join(''):'<p>No messages yet.</p>';
  $('#floatingMessageThread').scrollTop=$('#floatingMessageThread').scrollHeight;
}
function adminTransactionPanel(order){if(order.workflowStatus==='awaiting_admin_review')return `<form data-admin-confirm-fee="${order.id}"><p>Review the conversation and confirm the fee for ${escapeHtml(order.address?.address||'the saved address')}.</p><label>Delivery fee<input name="shipping_amount" type="number" min="0" step="1" value="${order.shippingAmount||150}" required></label><div><button type="submit">Confirm delivery fee</button><button type="button" class="transaction-secondary" data-admin-cancel="${order.id}">Cancel order</button></div></form>`;if(order.workflowStatus==='awaiting_address_confirmation')return '<p>Waiting for the customer to choose how the delivery fee will be paid.</p>';if(order.workflowStatus==='awaiting_admin_total_confirmation')return `<div><p>The customer selected <strong>${order.deliveryFeePayment==='pay_on_arrival'?'pay delivery fee upon arrival':'include delivery fee in payment'}</strong>. Review and confirm the final payment total of <strong>${money(order.total)}</strong>.</p><button type="button" data-admin-confirm-total="${order.id}">Confirm total payment</button></div>`;if(order.workflowStatus==='awaiting_payment')return '<p>The total is confirmed. Waiting for the customer to submit payment in this conversation.</p>';if(order.workflowStatus==='payment_verification')return `<p>Payment proof has been submitted.</p><button type="button" data-admin-verify="${order.id}">Verify payment</button>`;if(order.workflowStatus==='ready_for_fulfillment'&&order.deliveryStatus==='pending')return `<p>Payment is confirmed. Move the order into packing.</p><button type="button" data-admin-delivery="${order.id}" data-status="packing">Start packing</button>`;if(order.deliveryStatus==='packing')return `<p>The order is being packed.</p><button type="button" data-admin-delivery="${order.id}" data-status="in_transit">Mark in transit</button>`;if(order.workflowStatus==='in_transit'||order.deliveryStatus==='in_transit')return '<p>Order is in transit. Waiting for the customer to confirm receipt.</p>';if(order.workflowStatus==='completed')return '<p>Transaction completed successfully.</p>';if(order.workflowStatus==='cancelled')return '<p>This transaction was cancelled.</p>';return `<p>${escapeHtml((order.workflowStatus||order.status).replaceAll('_',' '))}</p>`;}
const baseAdminTransactionPanel=adminTransactionPanel;
adminTransactionPanel=function(order){if(order.workflowStatus!=='payment_verification')return baseAdminTransactionPanel(order);return `<div class="receipt-review-summary"><p>Payment proof is ready for review.</p><dl><div><dt>Amount</dt><dd>${money(order.total)}</dd></div><div><dt>Method</dt><dd>${escapeHtml(order.payment)}</dd></div><div><dt>Reference</dt><dd>${escapeHtml(order.paymentReference||'Not provided')}</dd></div></dl><button type="button" data-view-receipt="${order.id}">Review receipt</button></div><div class="receipt-review-modal" data-receipt-modal="${order.id}" aria-hidden="true"><section><header><div><small>Payment verification</small><h3>${escapeHtml(order.number)}</h3></div><button type="button" data-close-receipt aria-label="Close receipt preview">×</button></header><img src="${escapeHtml(order.receiptUrl||'')}" alt="Payment receipt for ${escapeHtml(order.number)}"><dl><div><dt>Reference number</dt><dd>${escapeHtml(order.paymentReference||'Not provided')}</dd></div><div><dt>Amount</dt><dd>${money(order.total)}</dd></div><div><dt>Method</dt><dd>${escapeHtml(order.payment)}</dd></div></dl><button type="button" data-admin-verify="${order.id}">Verify this payment</button></section></div>`;};
document.addEventListener('click',event=>{const view=event.target.closest('[data-view-receipt]');if(view){const modal=document.querySelector(`[data-receipt-modal="${view.dataset.viewReceipt}"]`);modal?.classList.add('open');modal?.setAttribute('aria-hidden','false');return;}const close=event.target.closest('[data-close-receipt]');if(close){const modal=close.closest('.receipt-review-modal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');return;}if(event.target.classList.contains('receipt-review-modal')){event.target.classList.remove('open');event.target.setAttribute('aria-hidden','true');}});
function adminOrderDetails(order){const items=(order.items||[]).map(item=>`<div class="admin-order-item"><strong>${escapeHtml(item.name)}</strong><span>${Number(item.quantity)} × ${money(item.price)}</span><b>${money(item.lineTotal??item.price*item.quantity)}</b></div>`).join('');return `<section class="admin-order-details"><header><span>Order details</span><small>${(order.items||[]).reduce((total,item)=>total+Number(item.quantity||0),0)} item(s)</small></header>${items||'<p>No product details available.</p>'}${Number(order.discountAmount||0)>0?`<div class="admin-order-discount"><span>Discount applied</span><strong>−${money(order.discountAmount)}</strong></div>`:''}</section>`;}
function adminOrderModuleDetails(order){const address=order.address||{};return `<div class="admin-order-module-grid"><div>${adminOrderDetails(order)}</div><dl><div><dt>Products subtotal</dt><dd>${money(order.subtotal)}</dd></div><div><dt>Discount</dt><dd>${Number(order.discountAmount||0)>0?`−${money(order.discountAmount)}`:'None'}</dd></div><div><dt>Delivery fee</dt><dd>${money(order.shippingAmount)}</dd></div><div class="module-final-total"><dt>Final total</dt><dd>${money(order.total)}</dd></div><div><dt>Payment</dt><dd>${escapeHtml(order.payment||'Not selected')} · ${escapeHtml(order.paymentStatus||'Pending')}</dd></div><div><dt>Delivery address</dt><dd>${escapeHtml(address.address||'Not provided')}${address.landmark?` · Landmark: ${escapeHtml(address.landmark)}`:''}</dd></div></dl></div>`;}
function adminTransactionSummary(order){return `${adminOrderDetails(order)}<div class="transaction-total-summary"><div class="transaction-amount product-amount"><span>Product total</span><strong>${money(order.subtotal)}</strong></div>${order.shippingAmount>0?`<div class="transaction-amount"><span>Delivery fee</span><strong>${money(order.shippingAmount)}</strong></div>`:''}<div class="transaction-amount final-amount"><span>Final payment total</span><strong>${money(order.total)}</strong></div></div>`;}
function renderAdminTransaction(){let panel=$('.admin-message-transaction');if(!panel){panel=document.createElement('section');panel.className='admin-message-transaction';$('#adminReply').before(panel);}const customerOrders=orders.filter(order=>Number(order.userId)===Number(selectedClient?.userId));const order=customerOrders.find(item=>!['completed','cancelled'].includes(item.workflowStatus))||customerOrders[0];panel.innerHTML=order?`<header><span>Active transaction</span><strong>${escapeHtml(order.number)}</strong><small>${escapeHtml(order.status)}</small></header>${adminTransactionSummary(order)}${adminTransactionPanel(order)}`:'<p>No order transaction for this customer.</p>';document.querySelectorAll('[data-admin-confirm-fee]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{await YG_api(`/api/orders/${form.dataset.adminConfirmFee}`,{method:'PATCH',body:JSON.stringify({shipping_amount:Number(form.elements.shipping_amount.value)})});await loadOrders();await renderAdminMessages();toast('Delivery fee confirmed');}catch(error){button.disabled=false;toast(error.message);}});document.querySelectorAll('[data-admin-confirm-total]').forEach(button=>button.onclick=async()=>{button.disabled=true;button.textContent='Confirming…';try{await YG_api(`/api/orders/${button.dataset.adminConfirmTotal}`,{method:'PATCH',body:JSON.stringify({workflow_status:'awaiting_payment'})});await loadOrders();await renderAdminMessages();toast('Total payment confirmed');}catch(error){button.disabled=false;button.textContent='Confirm total payment';toast(error.message);}});document.querySelectorAll('[data-admin-verify]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await YG_api(`/api/orders/${button.dataset.adminVerify}`,{method:'PATCH',body:JSON.stringify({payment_status:'verified',workflow_status:'ready_for_fulfillment'})});await loadOrders();await renderAdminMessages();toast('Payment verified');}catch(error){button.disabled=false;toast(error.message);}});document.querySelectorAll('[data-admin-delivery]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await YG_api(`/api/orders/${button.dataset.adminDelivery}`,{method:'PATCH',body:JSON.stringify({delivery_status:button.dataset.status})});await loadOrders();await renderAdminMessages();toast(button.dataset.status==='packing'?'Order moved to packing':'Order marked in transit');}catch(error){button.disabled=false;toast(error.message);}});document.querySelectorAll('[data-admin-cancel]').forEach(button=>button.onclick=async()=>{if(!await YG_confirm({title:'Cancel this transaction?',message:'The order will be cancelled and reserved stock restored.',confirmText:'Cancel order'}))return;await YG_api(`/api/orders/${button.dataset.adminCancel}`,{method:'PATCH',body:JSON.stringify({delivery_status:'cancelled',workflow_status:'cancelled'})});await loadOrders();await renderAdminMessages();toast('Transaction cancelled');});}
async function renderAdminMessages(){if(!selectedClient){renderFloatingMessages();return;}const list=await YG_api(`/api/messages?user_id=${selectedClient.userId}`);selectedClient.unreadMessages=0;knownUnreadCount=clients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);renderClients();$('#adminMessages').innerHTML=list.map(message=>`<div class="admin-bubble ${message.from==='support'?'support':''}"><strong class="message-author">${message.from==='support'?'You':escapeHtml(selectedClient.name)}</strong>${escapeHtml(message.text)}<small>${message.time}</small></div>`).join('')||'<p>No messages yet.</p>';renderAdminTransaction();const transaction=$('.admin-message-transaction');if(transaction){transaction.classList.add('admin-bubble','support','admin-transaction-chat');$('#adminMessages').appendChild(transaction);}$('#adminMessages').scrollTop=$('#adminMessages').scrollHeight;renderFloatingMessages(list);}
$('#adminReply').onsubmit=async event=>{event.preventDefault();if(!selectedClient)return toast('Select a customer first');const form=event.currentTarget,box=form.querySelector('textarea'),photo=form.querySelector('[type="file"]');if(!box.value.trim()&&!photo.files.length)return toast('Write a reply or attach a photo');const data=new FormData(form);data.set('user_id',selectedClient.userId);const button=form.querySelector('button[type="submit"],button:not([type])');button.disabled=true;try{await YG_api('/api/messages',{method:'POST',body:data});form.reset();YG_resetMessageAttachment(form);await renderAdminMessages();toast('Reply sent to customer');}catch(error){toast(error.message);}finally{button.disabled=false;}};
function toggleFloatingMessages(open){$('#floatingMessagePanel').classList.toggle('open',open);$('#floatingMessageToggle').setAttribute('aria-expanded',String(open));if(open&&selectedClient)renderAdminMessages();}
$('#floatingMessageToggle').onclick=()=>{const opening=!$('#floatingMessagePanel').classList.contains('open');if(opening){const unreadClient=clients.find(client=>Number(client.unreadMessages||0)>0);if(unreadClient){selectedClient=unreadClient;renderClients();}}toggleFloatingMessages(opening);};
$('#hideFloatingMessages').onclick=()=>toggleFloatingMessages(false);
$('#floatingMessageReply').onsubmit=async event=>{event.preventDefault();if(!selectedClient)return toast('Select a customer first');const form=event.currentTarget,box=form.querySelector('textarea'),photo=form.querySelector('[type="file"]');if(!box.value.trim()&&!photo.files.length)return toast('Write a reply or attach a photo');const data=new FormData(form);data.set('user_id',selectedClient.userId);const button=form.querySelector('button[type="submit"],button:not([type])');button.disabled=true;try{await YG_api('/api/messages',{method:'POST',body:data});form.reset();YG_resetMessageAttachment(form);await renderAdminMessages();toast('Reply sent to customer');}catch(error){toast(error.message);}finally{button.disabled=false;}};
const moduleDetails={
  overview:['Business overview','Dashboard','A quick look at sales, orders, and items that need attention.'],
  products:['Catalog management','Products','Create, update, hide, and organize products sold in the storefront.'],
  orders:['Order operations','Orders','Review payments and move customer orders through fulfillment.'],
  inventory:['Stock control','Inventory','Monitor quantities, low-stock items, batches, and expiry dates.'],
  payments:['Checkout settings','Payments','Configure payment methods, account details, and QR codes.'],
  customers:['Customer records','Customers','View registered customer profiles, order activity, and eligible offers.'],
  messages:['Customer care','Messages','Read and respond to customer support conversations.'],
  discounts:['Loyalty tools','Discounts','Manage valid offers and customer eligibility rules.'],
  reports:['Business records','Reports','Review product sales, orders, inventory quantities, and expiry records.'],
  administrators:['Access control','Administrators','Create and review authorized administrator accounts.'],
};

function openModule(moduleName,updateUrl=true){
  const name=moduleDetails[moduleName]?moduleName:'overview';
  document.body.classList.toggle('messages-module-open',name==='messages');
  document.querySelectorAll('[data-admin-module]').forEach(section=>section.classList.toggle('active',section.dataset.adminModule===name));
  document.querySelectorAll('[data-module]').forEach(button=>button.classList.toggle('active',button.dataset.module===name));
  const [kicker,title,description]=moduleDetails[name];
  $('#moduleKicker').textContent='Admin';
  $('#moduleTitle').textContent=title;
  $('#moduleDescription').textContent=title;
  if(updateUrl)history.replaceState(null,'',`#${name}`);
  if(name==='messages'&&selectedClient)selectClient(selectedClient.userId);
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('[data-module]').forEach(button=>button.onclick=()=>openModule(button.dataset.module));
document.querySelectorAll('[data-open-module]').forEach(button=>button.onclick=()=>openModule(button.dataset.openModule));
window.addEventListener('hashchange',()=>openModule(location.hash.slice(1),false));
$('#notificationsButton').onclick=()=>toast('Notifications are connected to database orders.');
function exportReportToExcel(){
  const panel=document.querySelector(`[data-report-panel="${activeReportFolder}"]`),title=$('#reportPrintTitle').textContent,range=$('#reportPrintRange').textContent,metrics=[...panel.querySelectorAll('.report-summary-grid article')].map(article=>`<tr><th>${escapeHtml(article.querySelector('span')?.textContent||'')}</th><td>${escapeHtml(article.querySelector('strong')?.textContent||'')}</td><td>${escapeHtml(article.querySelector('small')?.textContent||'')}</td></tr>`).join(''),table=panel.querySelector('table')?.outerHTML||'';
  const workbook=`<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;color:#2f261f}h1{font-size:20px;margin:8px 0}p{font-size:11px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #bdb5ae;padding:7px;text-align:left;font-size:10px}th{background:#eee8e2}</style></head><body><strong>You Glow Cebu Beauty &amp; Wellness</strong><h1>${escapeHtml(title)}</h1><p>${escapeHtml(range)}</p>${metrics?`<table>${metrics}</table>`:''}${table}</body></html>`,blob=new Blob([workbook],{type:'application/vnd.ms-excel;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`you-glow-${activeReportFolder}-report.xls`;document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
$('#printReports').onclick=()=>{$('#reportExportFormat').value==='excel'?exportReportToExcel():window.print();};
document.querySelectorAll('[data-report-folder]').forEach(button=>button.onclick=()=>{activeReportFolder=button.dataset.reportFolder;renderReports();});
$('#reportDateFrom').onchange=renderReports;$('#reportDateTo').onchange=renderReports;$('#clearReportDates').onclick=()=>{$('#reportDateFrom').value='';$('#reportDateTo').value='';renderReports();};
$('.sales-panel select').onchange=renderSalesChart;
$('#adminSignOut').onclick=async()=>{const button=$('#adminSignOut');button.disabled=true;button.textContent='Signing out…';try{await YG_api('/api/auth/logout',{method:'POST'});location.href='/admin/login';}catch(error){button.disabled=false;button.textContent='Sign out';toast(error.message);}};
async function initializeAdmin(){
  try{
    const member=await YG_api('/api/auth/me');
    if(member.role!=='admin')throw new Error('Admin access required.');
    $('.avatar').textContent=member.name.split(' ').map(part=>part[0]).slice(0,2).join('').toUpperCase();
    $('#adminIdentityName').textContent=member.name;
    openModule(location.hash.slice(1)||'overview',false);
    renderProducts();renderMetrics();renderExpiry();
    await Promise.all([loadOrders(),loadClients(),loadFeedback(),loadAdministrators(),loadPaymentMethods(),loadDiscounts()]);
    window.setInterval(loadOrders,30000);
    window.setInterval(()=>loadClients(true),10000);
  }catch(_){
    location.href='/admin/login';
  }
}

initializeAdmin();

function setupMobileAdminMessenger(){
  const grid=document.querySelector('.crm-grid');
  const identity=document.querySelector('.client-identity');
  if(!grid||!identity||identity.querySelector('.mobile-chat-back'))return;
  const back=document.createElement('button');
  back.type='button';
  back.className='mobile-chat-back';
  back.setAttribute('aria-label','Back to customer messages');
  back.textContent='‹';
  back.addEventListener('click',()=>grid.classList.remove('mobile-chat-open'));
  identity.prepend(back);
  document.querySelectorAll('[data-module="messages"]').forEach(button=>button.addEventListener('click',()=>grid.classList.remove('mobile-chat-open')));
}

const selectMobileAdminClient=selectClient;
selectClient=async function(userId){
  document.querySelector('.crm-grid')?.classList.add('mobile-chat-open');
  await selectMobileAdminClient(userId);
};

setupMobileAdminMessenger();

document.addEventListener('click',event=>{
  const trigger=event.target.closest('[data-view-receipt]');
  if(!trigger)return;
  const modal=document.querySelector(`[data-receipt-modal="${trigger.dataset.viewReceipt}"]`);
  const image=modal?.querySelector('img');
  if(!modal||!image)return;
  let status=modal.querySelector('.receipt-image-status');
  if(!status){
    status=document.createElement('p');
    status.className='receipt-image-status';
    image.after(status);
  }
  const source=(image.getAttribute('src')||'').split('?')[0];
  if(!source){
    status.textContent='No receipt image was attached to this payment.';
    status.classList.add('error');
    image.hidden=true;
    return;
  }
  status.textContent='Loading receipt image…';
  status.classList.remove('error');
  image.hidden=false;
  image.onload=()=>{status.textContent='';status.classList.remove('error');};
  image.onerror=()=>{image.hidden=true;status.textContent='The receipt image could not be displayed. Ask the customer to upload a JPG or PNG image again.';status.classList.add('error');};
  image.src=`${source}?preview=${Date.now()}`;
});

function enableEnterToSend(formSelector){
  const form=document.querySelector(formSelector);
  const textarea=form?.querySelector('textarea');
  if(!form||!textarea)return;
  form.querySelector('button[type="submit"], button:not([type])')?.setAttribute('aria-label','Send message');
  textarea.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.shiftKey||event.isComposing)return;
    event.preventDefault();
    if(!textarea.value.trim()&&!form.querySelector('[type="file"]')?.files.length)return;
    form.requestSubmit();
  });
}

enableEnterToSend('#adminReply');
enableEnterToSend('#floatingMessageReply');

const renderActiveAdminTransaction=renderAdminTransaction;
renderAdminMessages=async function(){
  if(!selectedClient){renderFloatingMessages();return;}
  const list=await YG_api(`/api/messages?user_id=${selectedClient.userId}`);
  selectedClient.unreadMessages=0;
  knownUnreadCount=clients.reduce((sum,client)=>sum+Number(client.unreadMessages||0),0);
  renderClients();
  const customerOrders=orders.filter(order=>Number(order.userId)===Number(selectedClient.userId));
  const completedOrders=customerOrders.filter(order=>order.workflowStatus==='completed'||order.deliveryStatus==='delivered');
  const activeOrder=customerOrders.find(order=>!['completed','cancelled'].includes(order.workflowStatus)&&order.deliveryStatus!=='delivered');
  const timeline=[
    ...list.map(message=>({type:'message',timestamp:Date.parse(message.timestamp)||0,message})),
    ...completedOrders.map(order=>({type:'completed-order',timestamp:Date.parse(order.completedAt)||0,order}))
  ].sort((a,b)=>a.timestamp-b.timestamp);
  $('#adminMessages').innerHTML=timeline.map(event=>{
    if(event.type==='message'){
      const message=event.message;
      return `<div class="admin-bubble ${message.from==='support'?'support':''}"><strong class="message-author">${message.from==='support'?'You':escapeHtml(selectedClient.name)}</strong>${renderMessageBody(message)}<small>${escapeHtml(message.time)}</small></div>`;
    }
    const order=event.order;
    return `<section class="admin-bubble admin-transaction-chat completed-transaction-event"><header><span>Completed order</span><strong>${escapeHtml(order.number)}</strong><small>${escapeHtml(order.completedTime||order.date)}</small></header>${adminOrderDetails(order)}<div class="transaction-total-summary completed-total-summary"><div class="transaction-amount final-amount"><span>Final total</span><strong>${money(order.total)}</strong><small>Delivered and received</small></div></div><p>Transaction completed successfully.</p></section>`;
  }).join('')||'<p>No messages yet.</p>';
  document.querySelector('.admin-message-transaction')?.remove();
  if(activeOrder){
    renderActiveAdminTransaction();
    const transaction=document.querySelector('.admin-message-transaction');
    if(transaction){
      transaction.classList.add('admin-bubble','support','admin-transaction-chat','active-transaction-event');
      $('#adminMessages').appendChild(transaction);
    }
  }
  $('#adminMessages').scrollTop=$('#adminMessages').scrollHeight;
  renderFloatingMessages(list);
};

/* Show the delivery information the customer verified before submitting. */
adminTransactionSummary=function(order){
  const address=order.address||{};
  const amounts=`<div class="transaction-total-summary"><div class="transaction-amount product-amount"><span>Product total</span><strong>${money(order.subtotal)}</strong></div>${order.shippingAmount>0?`<div class="transaction-amount"><span>Delivery fee</span><strong>${money(order.shippingAmount)}</strong></div>`:''}<div class="transaction-amount final-amount"><span>Final payment total</span><strong>${money(order.total)}</strong></div></div>`;
  return `${adminOrderDetails(order)}${amounts}<div class="admin-verified-address"><b>Customer-verified delivery details</b><p>${escapeHtml(order.customer||'Customer')} · ${escapeHtml(order.phone||'No mobile number')}</p><p><strong>Address:</strong> ${escapeHtml(address.address||'No address provided')}</p><p><strong>Landmark:</strong> ${escapeHtml(address.landmark||'Not provided')}</p><p class="address-region"><strong>Region:</strong> ${escapeHtml(address.region||'Not provided')} <span aria-hidden="true">·</span> <strong>Postal code:</strong> ${escapeHtml(address.postal||'Not provided')}</p></div>`;
};
