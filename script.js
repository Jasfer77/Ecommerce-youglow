if (location.pathname === '/index.html') {
  history.replaceState(null, '', `/${location.search}${location.hash}`);
}

const header = document.querySelector('.site-header');
const landingCartCount = document.querySelector('#landingCartCount');
function refreshLandingCartCount(){if(!landingCartCount)return;let cart={};try{cart=JSON.parse(localStorage.getItem('yg-cart')||'{}')||{};}catch(_){cart={};}const count=Object.values(cart).reduce((sum,quantity)=>sum+Number(quantity||0),0);landingCartCount.textContent=count;landingCartCount.hidden=count===0;}
refreshLandingCartCount();
window.addEventListener('storage',refreshLandingCartCount);
const menu = document.querySelector('.menu-button');

menu.addEventListener('click', () => {
  const open = header.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});

document.querySelectorAll('.site-header nav a').forEach((link) => {
  link.addEventListener('click', () => {
    header.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => observer.observe(element));
document.querySelector('#year').textContent = new Date().getFullYear();
