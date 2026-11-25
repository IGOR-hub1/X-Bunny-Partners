(function(){'use strict';
  var config=window.X_BUNNY_LOGIN,message=document.getElementById('message'),resolver=null,
    verificationId=null,recaptcha=null;
  if(!window.firebase||!window.DK_FIREBASE_CONFIG){message.textContent='Firebase Authentication indisponível.';return;}
  try{firebase.initializeApp(window.DK_FIREBASE_CONFIG);}catch(error){message.textContent=error.message;return;}
  async function check(user){
    if(!user)return;
    var response=await fetch('/api/affiliates/'+config.action,{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},
      body:'{}',cache:'no-store'
    });
    if(!response.ok){
      var data=await response.json().catch(function(){return {};});
      throw new Error(data.error||'Sua conta não tem acesso a este painel.');
    }
    location.replace(config.panel);
  }
  firebase.auth().onAuthStateChanged(function(user){if(user)check(user).catch(function(error){message.textContent=error.message;});});
  document.getElementById('login').addEventListener('submit',async function(event){
    event.preventDefault();
    var form=event.currentTarget,button=form.querySelector('button');button.disabled=true;message.textContent='Verificando acesso…';
    try{
      var result=await firebase.auth().signInWithEmailAndPassword(form.elements.email.value.trim(),form.elements.password.value);
      await check(result.user);
    }catch(error){
      if(error.code==='auth/multi-factor-auth-required'&&error.resolver){
        resolver=error.resolver;verificationId=null;
        var select=document.getElementById('mfa-factor');select.replaceChildren();
        resolver.hints.forEach(function(hint,index){
          if(hint.factorId===firebase.auth.PhoneMultiFactorGenerator.FACTOR_ID)
            select.add(new Option(hint.displayName||hint.phoneNumber||'Telefone cadastrado',String(index)));
        });
        if(select.options.length){document.getElementById('mfa').hidden=false;
          message.textContent='Escolha o telefone cadastrado e confirme o segundo fator.';}
        else message.textContent='Esta conta usa um segundo fator ainda não suportado por esta tela. Contate o administrador.';
      }else message.textContent=error.message||'Falha ao entrar.';
      button.disabled=false;
    }
  });
  document.getElementById('mfa-send').addEventListener('click',async function(){
    if(!resolver)return;
    this.disabled=true;message.textContent='Preparando verificação por SMS…';
    try{
      if(recaptcha){recaptcha.clear();recaptcha=null;}
      recaptcha=new firebase.auth.RecaptchaVerifier('recaptcha-container',{size:'normal'});
      await recaptcha.render();
      var hint=resolver.hints[Number(document.getElementById('mfa-factor').value)];
      var provider=new firebase.auth.PhoneAuthProvider();
      verificationId=await provider.verifyPhoneNumber({multiFactorHint:hint,session:resolver.session},recaptcha);
      message.textContent='Código SMS enviado. Digite o código recebido.';
    }catch(error){message.textContent=error.message||'Não foi possível enviar o código.';this.disabled=false;}
  });
  document.getElementById('mfa-verify').addEventListener('submit',async function(event){
    event.preventDefault();if(!resolver||!verificationId){message.textContent='Envie o código SMS primeiro.';return;}
    var button=this.querySelector('button');button.disabled=true;
    try{
      var credential=firebase.auth.PhoneAuthProvider.credential(verificationId,this.elements.code.value.trim());
      var assertion=firebase.auth.PhoneMultiFactorGenerator.assertion(credential);
      var result=await resolver.resolveSignIn(assertion);
      await check(result.user);
    }catch(error){message.textContent=error.message||'Código inválido.';button.disabled=false;}
  });
})();
