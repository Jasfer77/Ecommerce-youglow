const adminLoginForm=document.querySelector('#adminLoginForm');
const adminLoginError=document.querySelector('#adminLoginError');

(async()=>{
  try{
    const user=await YG_api('/api/auth/me');
    if(user.role==='admin')location.replace('/admin');
  }catch(_){/* Remain on the login screen. */}
})();

adminLoginForm.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=adminLoginForm.querySelector('[type="submit"]');
  const original=button.innerHTML;
  adminLoginError.hidden=true;
  button.disabled=true;
  button.textContent='Signing in…';
  try{
    const user=await YG_api('/api/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(adminLoginForm)))});
    if(user.role!=='admin'){
      await YG_api('/api/auth/logout',{method:'POST',body:'{}'});
      throw new Error('This account does not have administrator access.');
    }
    location.replace('/admin');
  }catch(error){
    adminLoginError.textContent=error.message||'Unable to sign in. Please try again.';
    adminLoginError.hidden=false;
    button.disabled=false;
    button.innerHTML=original;
  }
});
