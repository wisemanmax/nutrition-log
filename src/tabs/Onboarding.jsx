import React, { useState, useEffect, useRef } from 'react';
import { V, Haptic } from '../utils/theme';
import { LS, Cookie } from '../utils/storage';
import { Icons } from '../components/Icons';
import { Btn, Card, Field } from '../components/ui';
import { uid, today, isValidEmail } from '../utils/helpers';
import { CloudSync, SYNC_URL } from '../utils/sync';
import { AuthToken, SessionManager } from '../utils/auth';
import { SentryUtil } from '../utils/sentry';
import { init } from '../state/reducer';

// --- Profanity filter ---
const BLOCKED_WORDS=["fuck","shit","ass","bitch","dick","pussy","cunt","damn","cock","porn","nigger","nigga","faggot","retard","whore","slut","bastard"];
const containsProfanity=(text)=>{const lower=(text||"").toLowerCase().replace(/[^a-z]/g,"");return BLOCKED_WORDS.some(w=>lower.includes(w));};
const getAge=(dob)=>{if(!dob)return 0;const b=new Date(dob),t=new Date(),a=t.getFullYear()-b.getFullYear();return t.getMonth()<b.getMonth()||(t.getMonth()===b.getMonth()&&t.getDate()<b.getDate())?a-1:a;};

const fetchWithTimeout=(url,opts,ms=10000)=>{
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),ms);
  return fetch(url,{...opts,signal:ctrl.signal}).finally(()=>clearTimeout(timer));
};

const US_STATES=["Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware",
  "Florida","Georgia","Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine",
  "Maryland","Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada",
  "New Hampshire","New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma",
  "Oregon","Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming","Other"];

const TOUR_SLIDES=[
  {icon:"\uD83E\uDD57",grad:"135deg,#4ade80,#22d3ee",title:"Track Every Macro",desc:"Log calories, protein, carbs, and fat with a database of 500+ foods. Hit your targets every day."},
  {icon:"\uD83C\uDF73",grad:"135deg,#a78bfa,#818cf8",title:"Log Meals Easily",desc:"Add breakfast, lunch, dinner, and snacks. Search foods, scan barcodes, or enter custom items."},
  {icon:"\u2696\uFE0F",grad:"135deg,#fb923c,#f43f5e",title:"Track Body Metrics",desc:"Log weight, body fat, and measurements. Watch your body composition change over time."},
  {icon:"\uD83D\uDCC8",grad:"135deg,#22d3ee,#3b82f6",title:"See Your Trends",desc:"Visualize calories, macros, and weight over weeks and months. Stay consistent, see results."},
];

export function Onboarding({d}){
  // --- Onboarding state ---
  const [step,setStep]=useState(0); // 0=welcome, 1=tour, 2=units, 3=goals, 4=profile, 5=pin
  const [tourIdx,setTourIdx]=useState(0);
  const [units,setUnits]=useState("lbs");
  const [goals,setGoals]=useState({cal:"2400",protein:"180",carbs:"250",fat:"70"});
  const [profile,setProfile]=useState({firstName:"",lastName:"",nickname:"",email:"",dob:"",sex:"",state:"",height:"",city:"",zipCode:""});
  const [agreed,setAgreed]=useState(false);
  const [accountPin,setAccountPin]=useState("");
  const [confirmPin,setConfirmPin]=useState("");
  const [pinError,setPinError]=useState("");
  const [sending,setSending]=useState(false);

  // --- Sign-in state ---
  const [showSignIn,setShowSignIn]=useState(false);
  const [signInEmail,setSignInEmail]=useState("");
  const [signInPin,setSignInPin]=useState("");
  const [signInLoading,setSignInLoading]=useState(false);
  const [signInError,setSignInError]=useState("");
  const [signInStep,setSignInStep]=useState("email");

  // --- Forgot PIN state ---
  const [forgotEmail,setForgotEmail]=useState("");
  const [forgotCode,setForgotCode]=useState("");
  const [forgotNewPin,setForgotNewPin]=useState("");
  const [forgotConfirmPin,setForgotConfirmPin]=useState("");
  const [forgotResetToken,setForgotResetToken]=useState("");
  const [forgotLoading,setForgotLoading]=useState(false);
  const [forgotError,setForgotError]=useState("");
  const [forgotSuccess,setForgotSuccess]=useState("");

  // --- Email verification state ---
  const [verifyStep,setVerifyStep]=useState(null);
  const [verifyCode,setVerifyCode]=useState("");
  const [verifyLoading,setVerifyLoading]=useState(false);
  const [verifyError,setVerifyError]=useState("");
  const [verifyCooldown,setVerifyCooldown]=useState(0);

  // --- SSO detection ---
  const [sso,setSSO]=useState(null);
  useEffect(()=>{
    const token=LS.get("ft-session-token")||Cookie.get("ironlog_session");
    if(token){
      fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json","X-Session-Token":token},
        body:JSON.stringify({action:"validate"})}).then(r=>r.json()).then(j=>{
        if(j.valid)setSSO({valid:true,token,email:j.email,type:"ironlog"});
      }).catch(()=>{});
    }
  },[]);

  // --- Validation ---
  const nameClean=!containsProfanity(profile.firstName)&&!containsProfanity(profile.lastName);
  const emailValid=isValidEmail(profile.email);
  const ageValid=getAge(profile.dob)>=13;
  const profileValid=profile.firstName.trim()&&profile.lastName.trim()&&profile.email.trim()&&profile.dob&&profile.sex&&profile.state&&agreed&&nameClean&&emailValid&&ageValid;

  // --- Finish signup ---
  const finish=async()=>{
    if(accountPin.length!==6){setPinError("PIN must be exactly 6 digits");return;}
    if(accountPin!==confirmPin){setPinError("PINs don't match");return;}
    setPinError("");setSending(true);
    try{
      LS.set("ft-account-pin",accountPin);
      const payload={
        ...profile,units,primaryGoal:"nutrition",
        accountPin,createdAt:new Date().toISOString(),
        consentedAt:new Date().toISOString(),consentVersion:"1.0",deviceId:uid(),
        app:"nutritionlog",
      };
      try{await fetchWithTimeout(`${SYNC_URL}/api/users`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});}catch(e){}
      d({type:"SET_PROFILE",profile});
      d({type:"UNITS",units});
      d({type:"GOALS",g:{cal:parseInt(goals.cal)||2400,protein:parseInt(goals.protein)||180,carbs:parseInt(goals.carbs)||250,fat:parseInt(goals.fat)||70}});
      AuthToken.init(profile.email);
      LS.set("ft-device-id",payload.deviceId);
      await SessionManager.create(profile.email,accountPin,payload.deviceId);
      try{await fetchWithTimeout(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"send_verify_code",email:profile.email})});}catch(e){}
    }finally{
      setVerifyStep("pending");setSending(false);
    }
  };

  // --- Email verification ---
  const verifySendCode=async(emailAddr)=>{
    try{await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"send_verify_code",email:emailAddr||profile.email})});}catch(e){}
  };
  const verifyConfirmCode=async()=>{
    if(verifyCode.length!==6){setVerifyError("Enter the 6-digit code");return;}
    setVerifyLoading(true);setVerifyError("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"confirm_verify_code",email:profile.email,code:verifyCode})});
      const json=await res.json();
      if(json.verified||json.already_verified){
        setVerifyStep("done");LS.set("nl-email-verified","true");
        setTimeout(()=>{d({type:"ONBOARDED"});},1200);
      }else{setVerifyError(json.error||"Incorrect code");}
    }catch(e){setVerifyError("Connection failed.");}
    setVerifyLoading(false);
  };
  const verifyResend=async()=>{
    if(verifyCooldown>0)return;
    await verifySendCode(profile.email);
    setVerifyCooldown(60);
    const t=setInterval(()=>setVerifyCooldown(c=>{if(c<=1){clearInterval(t);return 0;}return c-1;}),1000);
  };

  // --- Sign-in flow ---
  const signIn=async()=>{
    if(signInStep==="email"){
      if(!signInEmail.trim()||!signInEmail.includes("@")){setSignInError("Enter a valid email");return;}
      setSignInLoading(true);setSignInError("");
      try{
        AuthToken.init(signInEmail);
        const deviceId=uid();LS.set("ft-device-id",deviceId);
        const result=await CloudSync.pull(signInEmail.trim().toLowerCase(),deviceId,null);
        if(result?.pin_required){setSignInStep("pin");}
        else if(result&&result.success&&result.data){applyRestore(result.data,null);}
        else{setSignInError(result?.error||"No account found with this email.");}
      }catch(e){setSignInError("Connection failed");}
      setSignInLoading(false);return;
    }
    if(signInStep==="pin"){
      if(signInPin.length!==6){setSignInError("Enter your 6-digit PIN");return;}
      setSignInLoading(true);setSignInError("");
      try{
        const deviceId=LS.get("ft-device-id")||uid();
        const result=await CloudSync.pull(signInEmail.trim().toLowerCase(),deviceId,signInPin);
        if(result?.wrong_pin){setSignInError(`Wrong PIN.${result.attempts_remaining!=null?` ${result.attempts_remaining} attempts left.`:""}`);setSignInLoading(false);return;}
        if(result?.locked){setSignInError("Account locked for 15 minutes.");setSignInLoading(false);return;}
        if(result?.success&&result.data){applyRestore(result.data,signInPin);}
        else{setSignInError(result?.error||"Could not restore data.");}
      }catch(e){setSignInError("Connection failed");}
      setSignInLoading(false);
    }
  };

  const [returningUser,setReturningUser]=useState(false);

  const applyRestore=(cloud,pinUsed)=>{
    const merged={
      nutrition:cloud.nutrition||[],body:cloud.body||[],
      goals:cloud.settings?.goals||cloud.goals||init.goals,
      units:cloud.settings?.units||cloud.units||"lbs",
      profile:cloud.profile||{email:signInEmail.trim().toLowerCase()},
    };
    d({type:"IMPORT",data:merged});
    d({type:"SET_PROFILE",profile:merged.profile});
    if(merged.units)d({type:"UNITS",units:merged.units});
    if(merged.goals)d({type:"GOALS",g:merged.goals});
    if(merged.profile)setProfile(p=>({...p,...merged.profile}));
    SentryUtil.identify(merged.profile.email,`${merged.profile.firstName} ${merged.profile.lastName}`);
    if(pinUsed)SessionManager.create(signInEmail.trim().toLowerCase(),pinUsed,LS.get("ft-device-id"));
    setReturningUser(true);
    setShowSignIn(false);
    setStep(1);
  };

  // --- Forgot PIN flow ---
  const forgotSendCode=async()=>{
    if(!forgotEmail.trim()||!forgotEmail.includes("@")){setForgotError("Enter a valid email");return;}
    setForgotLoading(true);setForgotError("");
    try{await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"send_reset_code",email:forgotEmail.trim().toLowerCase()})});
      setSignInStep("forgot_code");setForgotSuccess("If that email exists, a code was sent.");
    }catch(e){setForgotError("Connection failed.");}
    setForgotLoading(false);
  };
  const forgotVerifyCode=async()=>{
    if(forgotCode.length!==6){setForgotError("Enter the 6-digit code");return;}
    setForgotLoading(true);setForgotError("");setForgotSuccess("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"verify_reset_code",email:forgotEmail.trim().toLowerCase(),code:forgotCode})});
      const json=await res.json();
      if(json.reset_token){setForgotResetToken(json.reset_token);setSignInStep("forgot_newpin");setForgotError("");}
      else{setForgotError(json.error||"Invalid code");}
    }catch(e){setForgotError("Connection failed.");}
    setForgotLoading(false);
  };
  const forgotSetPin=async()=>{
    if(forgotNewPin.length!==6){setForgotError("PIN must be 6 digits");return;}
    if(forgotNewPin!==forgotConfirmPin){setForgotError("PINs don't match");return;}
    setForgotLoading(true);setForgotError("");
    try{
      const res=await fetch(`${SYNC_URL}/api/auth/session`,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"set_new_pin",email:forgotEmail.trim().toLowerCase(),resetToken:forgotResetToken,newPin:forgotNewPin})});
      const json=await res.json();
      if(json.success){setForgotSuccess("PIN updated! Sign in with your new PIN.");setSignInStep("pin");setSignInEmail(forgotEmail);setSignInPin("");}
      else{setForgotError(json.error||"Failed to update PIN");}
    }catch(e){setForgotError("Connection failed.");}
    setForgotLoading(false);
  };

  // --- SSO link ---
  const linkSSO=()=>{
    if(!sso?.valid)return;
    LS.set("ft-session-token",sso.token);
    LS.set("ft-session-email",sso.email||"");
    LS.set("nl-sso-linked",true);
    setProfile(p=>({...p,email:sso.email||""}));
    setStep(2);
  };

  // ==========================================
  // RENDER
  // ==========================================

  // --- Email Verification Screen ---
  if(verifyStep){
    return(
      <div style={{minHeight:"100vh",background:V.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        {verifyStep==="done"?(
          <div style={{textAlign:"center",animation:"fadeUp .5s ease"}}>
            <div style={{fontSize:56,marginBottom:16}}>&#x2705;</div>
            <div style={{fontSize:22,fontWeight:800,color:V.text}}>Email Verified!</div>
            <div style={{fontSize:13,color:V.text3,marginTop:8}}>Setting up your account...</div>
          </div>
        ):(
          <div style={{maxWidth:360,width:"100%",animation:"fadeUp .4s ease"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:48,marginBottom:12}}>&#x1F4E7;</div>
              <div style={{fontSize:20,fontWeight:800,color:V.text}}>Verify Your Email</div>
              <div style={{fontSize:12,color:V.text3,marginTop:6}}>We sent a 6-digit code to <strong style={{color:V.accent}}>{profile.email}</strong></div>
            </div>
            <Field label="Verification Code" value={verifyCode} onChange={setVerifyCode} placeholder="000000" inputMode="numeric" autoFocus/>
            {verifyError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{verifyError}</div>}
            <Btn full onClick={verifyConfirmCode} disabled={verifyLoading}>{verifyLoading?"Verifying...":"Verify Email"}</Btn>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}>
              <button onClick={verifyResend} disabled={verifyCooldown>0} style={{background:"none",border:"none",color:verifyCooldown>0?V.text3:V.accent,fontSize:12,cursor:"pointer",fontFamily:V.font}}>
                {verifyCooldown>0?`Resend in ${verifyCooldown}s`:"Resend Code"}
              </button>
              <button onClick={()=>{LS.set("nl-email-verified","skipped");d({type:"ONBOARDED"});}} style={{background:"none",border:"none",color:V.text3,fontSize:12,cursor:"pointer",fontFamily:V.font}}>Skip for now</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Sign-in Screen ---
  if(showSignIn){
    return(
      <div style={{minHeight:"100vh",background:V.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{maxWidth:360,width:"100%",animation:"fadeUp .4s ease"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{fontSize:22,fontWeight:800,color:V.text}}>Welcome Back</div>
            <div style={{fontSize:12,color:V.text3}}>Sign in to restore your data</div>
          </div>
          <button onClick={()=>{
            if(signInStep==="email"){setShowSignIn(false);return;}
            if(signInStep==="forgot"||signInStep==="forgot_code"||signInStep==="forgot_newpin"){setSignInStep("email");setForgotError("");setForgotSuccess("");return;}
            setSignInStep("email");setSignInError("");
          }} style={{background:"none",border:"none",display:"flex",alignItems:"center",gap:5,cursor:"pointer",padding:"8px 0",marginBottom:12}}>
            {Icons.chevLeft({size:18,color:V.accent})}<span style={{fontSize:14,color:V.accent,fontWeight:600}}>Back</span>
          </button>

          {signInStep==="email"&&(<>
            <Field label="Email" type="email" value={signInEmail} onChange={setSignInEmail} placeholder="you@example.com" autoFocus/>
            {signInError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{signInError}</div>}
            <Btn full onClick={signIn} disabled={signInLoading}>{signInLoading?"Looking up...":"Continue"}</Btn>
          </>)}

          {signInStep==="pin"&&(<>
            <Field label="6-digit PIN" type="password" value={signInPin} onChange={setSignInPin} placeholder="******" inputMode="numeric" autoFocus/>
            {signInError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{signInError}</div>}
            <Btn full onClick={signIn} disabled={signInLoading}>{signInLoading?"Signing in...":"Sign In"}</Btn>
            <button onClick={()=>{setSignInStep("forgot");setForgotEmail(signInEmail);setForgotError("");setForgotSuccess("");}}
              style={{display:"block",width:"100%",background:"none",border:"none",cursor:"pointer",fontSize:12,color:V.accent,fontFamily:V.font,padding:12,textAlign:"center",marginTop:8}}>Forgot PIN?</button>
          </>)}

          {signInStep==="forgot"&&(<>
            <div style={{fontSize:13,color:V.text3,marginBottom:12}}>Enter your email to receive a PIN reset code.</div>
            <Field label="Email" type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="you@example.com" autoFocus/>
            {forgotError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{forgotError}</div>}
            <Btn full onClick={forgotSendCode} disabled={forgotLoading}>{forgotLoading?"Sending...":"Send Reset Code"}</Btn>
          </>)}

          {signInStep==="forgot_code"&&(<>
            {forgotSuccess&&<div style={{fontSize:12,color:V.accent,marginBottom:8}}>{forgotSuccess}</div>}
            <Field label="6-digit Reset Code" value={forgotCode} onChange={setForgotCode} placeholder="000000" inputMode="numeric" autoFocus/>
            {forgotError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{forgotError}</div>}
            <Btn full onClick={forgotVerifyCode} disabled={forgotLoading}>{forgotLoading?"Verifying...":"Verify Code"}</Btn>
          </>)}

          {signInStep==="forgot_newpin"&&(<>
            <div style={{fontSize:13,color:V.text3,marginBottom:12}}>Set your new 6-digit PIN.</div>
            <Field label="New PIN" type="password" value={forgotNewPin} onChange={setForgotNewPin} placeholder="******" inputMode="numeric" autoFocus/>
            <Field label="Confirm PIN" type="password" value={forgotConfirmPin} onChange={setForgotConfirmPin} placeholder="******" inputMode="numeric"/>
            {forgotError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{forgotError}</div>}
            {forgotSuccess&&<div style={{fontSize:12,color:V.accent,marginBottom:8}}>{forgotSuccess}</div>}
            <Btn full onClick={forgotSetPin} disabled={forgotLoading}>{forgotLoading?"Updating...":"Update PIN"}</Btn>
          </>)}
        </div>
      </div>
    );
  }

  // === ONBOARDING STEPS ===

  return(
    <div style={{minHeight:"100vh",background:V.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{maxWidth:400,width:"100%"}}>

        {/* --- Step 0: Welcome --- */}
        {step===0&&(
          <div style={{textAlign:"center",animation:"fadeUp .5s ease"}}>
            <div style={{width:72,height:72,borderRadius:22,background:`linear-gradient(135deg,${V.accent},${V.accent2})`,
              display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:20,
              boxShadow:`0 12px 40px ${V.accent}30`}}>
              {Icons.leaf({size:32,color:V.bg})}
            </div>
            <div style={{fontSize:30,fontWeight:800,color:V.text,letterSpacing:"-.03em"}}>Nutrition<span style={{color:V.accent}}>Log</span></div>
            <div style={{fontSize:14,color:V.text3,marginBottom:24,lineHeight:1.7}}>Track your macros, build healthy habits.</div>

            {sso?.valid&&(
              <Card style={{padding:14,marginBottom:16,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
                <div style={{fontSize:18}}>&#x1F517;</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:V.accent}}>IronLog Account Detected</div>
                  <div style={{fontSize:10,color:V.text3}}>{sso.email}</div>
                </div>
                <Btn v="small" onClick={linkSSO}>Link</Btn>
              </Card>
            )}

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <Btn full onClick={()=>setStep(1)}>{Icons.plus({size:16,color:V.bg})} Get Started — It's Free</Btn>
              <Btn v="secondary" full onClick={()=>setShowSignIn(true)}>{Icons.user({size:14,color:V.text2})} Sign In — Restore My Data</Btn>
            </div>
            <div style={{fontSize:11,color:V.text3,marginTop:16}}>All data stored locally - 100% private</div>
          </div>
        )}

        {/* --- Step 1: Tour --- */}
        {step===1&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{width:64,height:64,borderRadius:20,background:`linear-gradient(${TOUR_SLIDES[tourIdx].grad})`,
                display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:16}}>{TOUR_SLIDES[tourIdx].icon}</div>
              <div style={{fontSize:20,fontWeight:800,color:V.text,marginBottom:8}}>{TOUR_SLIDES[tourIdx].title}</div>
              <div style={{fontSize:13,color:V.text3,lineHeight:1.6}}>{TOUR_SLIDES[tourIdx].desc}</div>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>
              {TOUR_SLIDES.map((_,i)=>(
                <div key={i} style={{width:8,height:8,borderRadius:4,background:i===tourIdx?V.accent:`${V.accent}30`,transition:"all .2s"}}/>
              ))}
            </div>
            <Btn full onClick={()=>{if(tourIdx<TOUR_SLIDES.length-1)setTourIdx(tourIdx+1);else setStep(2);}}>
              {tourIdx<TOUR_SLIDES.length-1?"Next":"Let's Go!"}
            </Btn>
            {tourIdx>0&&<Btn v="ghost" full onClick={()=>setTourIdx(tourIdx-1)} s={{marginTop:8}}>Back</Btn>}
          </div>
        )}

        {/* --- Step 2: Units --- */}
        {step===2&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:36,marginBottom:8}}>&#x2696;&#xFE0F;</div>
              <div style={{fontSize:20,fontWeight:800,color:V.text}}>Choose Your Units</div>
              <div style={{fontSize:12,color:V.text3}}>This sets how weight is displayed</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20}}>
              {[{id:"lbs",label:"Pounds (lbs)",desc:"US standard"},{id:"kg",label:"Kilograms (kg)",desc:"Metric system"}].map(u=>(
                <button key={u.id} onClick={()=>setUnits(u.id)} style={{padding:"18px 14px",borderRadius:14,
                  background:units===u.id?`${V.accent}12`:"rgba(255,255,255,0.03)",
                  border:`1.5px solid ${units===u.id?V.accent:V.cardBorder}`,cursor:"pointer",textAlign:"left"}}>
                  <div style={{fontSize:16,fontWeight:700,color:units===u.id?V.accent:V.text}}>{u.label}</div>
                  <div style={{fontSize:10,color:V.text3,marginTop:2}}>{u.desc}</div>
                </button>
              ))}
            </div>
            <Btn full onClick={()=>setStep(3)}>Next</Btn>
            <Btn v="ghost" full onClick={()=>setStep(1)} s={{marginTop:8}}>Back</Btn>
          </div>
        )}

        {/* --- Step 3: Daily Goals --- */}
        {step===3&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:36,marginBottom:8}}>&#x1F3AF;</div>
              <div style={{fontSize:20,fontWeight:800,color:V.text}}>Set Your Daily Goals</div>
              <div style={{fontSize:12,color:V.text3}}>Optional — you can always change these later</div>
            </div>
            <Field label="Calories" type="number" value={goals.cal} onChange={v=>setGoals(g=>({...g,cal:v}))} placeholder="e.g. 2400" unit="kcal"/>
            <Field label="Protein" type="number" value={goals.protein} onChange={v=>setGoals(g=>({...g,protein:v}))} placeholder="e.g. 180" unit="g"/>
            <Field label="Carbs" type="number" value={goals.carbs} onChange={v=>setGoals(g=>({...g,carbs:v}))} placeholder="e.g. 250" unit="g"/>
            <Field label="Fat" type="number" value={goals.fat} onChange={v=>setGoals(g=>({...g,fat:v}))} placeholder="e.g. 70" unit="g"/>
            <Btn full onClick={()=>{
              d({type:"GOALS",g:{cal:parseInt(goals.cal)||2400,protein:parseInt(goals.protein)||180,carbs:parseInt(goals.carbs)||250,fat:parseInt(goals.fat)||70}});
              if(returningUser){d({type:"ONBOARDED"});}else{setStep(4);}
            }}>{returningUser?"Finish Setup":"Next"}</Btn>
            <Btn v="ghost" full onClick={()=>setStep(2)} s={{marginTop:8}}>Back</Btn>
          </div>
        )}

        {/* --- Step 4: Profile --- */}
        {step===4&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:36,marginBottom:8}}>&#x1F464;</div>
              <div style={{fontSize:20,fontWeight:800,color:V.text}}>Create Your Profile</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="First Name *" value={profile.firstName} onChange={v=>setProfile(p=>({...p,firstName:v}))} placeholder="John"/>
              <Field label="Last Name *" value={profile.lastName} onChange={v=>setProfile(p=>({...p,lastName:v}))} placeholder="Doe"/>
            </div>
            <Field label="Email *" type="email" value={profile.email} onChange={v=>setProfile(p=>({...p,email:v}))} placeholder="you@example.com"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Date of Birth *" type="date" value={profile.dob} onChange={v=>setProfile(p=>({...p,dob:v}))}/>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>Sex *</div>
                <div style={{display:"flex",gap:6}}>
                  {["Male","Female"].map(sx=>(
                    <button key={sx} onClick={()=>setProfile(p=>({...p,sex:sx}))} style={{flex:1,padding:"10px 8px",borderRadius:10,
                      background:profile.sex===sx?`${V.accent}12`:"rgba(255,255,255,0.04)",
                      border:`1px solid ${profile.sex===sx?V.accent:V.cardBorder}`,cursor:"pointer",
                      fontSize:12,fontWeight:600,color:profile.sex===sx?V.accent:V.text3,fontFamily:V.font}}>{sx}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:V.text3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontWeight:600}}>State *</div>
              <select value={profile.state} onChange={e=>setProfile(p=>({...p,state:e.target.value}))}
                style={{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.cardBorder}`,
                  borderRadius:12,color:V.text,fontSize:14,fontFamily:V.font,outline:"none",minHeight:44}}>
                <option value="">Select state...</option>
                {US_STATES.map(st=><option key={st} value={st}>{st}</option>)}
              </select>
            </div>
            <button onClick={()=>setAgreed(!agreed)} style={{display:"flex",alignItems:"flex-start",gap:10,background:"none",border:"none",
              cursor:"pointer",padding:"8px 0",textAlign:"left",marginBottom:16}}>
              <div style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${agreed?V.accent:V.cardBorder}`,
                background:agreed?V.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
                {agreed&&Icons.check({size:12,color:V.bg})}
              </div>
              <div style={{fontSize:11,color:V.text3,lineHeight:1.5}}>
                I agree to the Terms of Service and Privacy Policy
              </div>
            </button>
            {!profileValid&&profile.firstName&&(
              <div style={{fontSize:11,color:V.danger,textAlign:"center",marginBottom:8}}>
                {!nameClean?"Please use appropriate names":!emailValid?"Enter a valid email":!ageValid?"Must be 13+ to use NutritionLog":"Fill in all required fields"}
              </div>
            )}
            <Btn full onClick={()=>setStep(5)} disabled={!profileValid}>Next</Btn>
            <Btn v="ghost" full onClick={()=>setStep(3)} s={{marginTop:8}}>Back</Btn>
          </div>
        )}

        {/* --- Step 5: PIN Creation --- */}
        {step===5&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:36,marginBottom:8}}>&#x1F512;</div>
              <div style={{fontSize:20,fontWeight:800,color:V.text}}>Secure Your Account</div>
              <div style={{fontSize:12,color:V.text3}}>Create a 6-digit PIN to protect your data</div>
            </div>
            <Field label="Create PIN" type="password" value={accountPin} onChange={v=>{if(/^\d{0,6}$/.test(v))setAccountPin(v);}} placeholder="******" inputMode="numeric" autoFocus/>
            <Field label="Confirm PIN" type="password" value={confirmPin} onChange={v=>{if(/^\d{0,6}$/.test(v))setConfirmPin(v);}} placeholder="******" inputMode="numeric"/>
            {pinError&&<div style={{fontSize:12,color:V.danger,marginBottom:8}}>{pinError}</div>}
            <Btn full onClick={finish} disabled={sending}>{sending?"Creating account...":"Complete Setup"}</Btn>
            <Btn v="ghost" full onClick={()=>setStep(4)} s={{marginTop:8}}>Back</Btn>
          </div>
        )}

        {/* Step indicator */}
        {step>=1&&step<=5&&(
          <div style={{display:"flex",justifyContent:"center",gap:4,marginTop:20}}>
            {[1,2,3,4,5].map(i=>(
              <div key={i} style={{width:step===i?20:8,height:4,borderRadius:2,
                background:step>=i?V.accent:`${V.accent}20`,transition:"all .3s"}}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
