// Email-code login, shared by the account page and the admin desk.
type Lang = 'en' | 'ar';
const T = {
  en: { email: 'Email', send: 'Email me a code', code: '6-digit code', verify: 'Log in', sent: (e: string) => `We sent a code to ${e}. It may take a minute; check spam too.`, again: 'Use a different email', busy: 'One moment…', fail: 'Something went wrong. Try again.',
    errors: { email: 'Check the email address.', 'wrong-code': 'That code is not right.', expired: 'That code has expired. Ask for a new one.', 'too-many': 'Too many tries. Wait a little, then ask for a new code.' } as Record<string, string> },
  ar: { email: 'البريد الإلكتروني', send: 'أرسلوا لي رمزاً', code: 'الرمز من ٦ أرقام', verify: 'دخول', sent: (e: string) => `أرسلنا رمزاً إلى ${e}. قد يتأخر دقيقة؛ تحقق من البريد المزعج أيضاً.`, again: 'استخدم بريداً آخر', busy: 'لحظة…', fail: 'حدث خطأ. حاول مرة أخرى.',
    errors: { email: 'تحقق من البريد الإلكتروني.', 'wrong-code': 'الرمز غير صحيح.', expired: 'انتهت صلاحية الرمز. اطلب رمزاً جديداً.', 'too-many': 'محاولات كثيرة. انتظر قليلاً ثم اطلب رمزاً جديداً.' } as Record<string, string> },
};
// The server's messages are English only, so the page says them in its own language by error code.

export function mountLogin(root: HTMLElement, lang: Lang, onDone: (user: { email: string; role: string }) => void) {
  const t = T[lang];
  root.innerHTML = `
    <form class="lg" novalidate>
      <div class="field lg-email"><label for="lg-e">${t.email}</label><input id="lg-e" type="email" autocomplete="email" dir="ltr" required /></div>
      <div class="field lg-code" hidden><p class="lg-sent"></p><label for="lg-c">${t.code}</label><input id="lg-c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" pattern="[0-9]{6}" /></div>
      <p class="err" role="alert" hidden></p>
      <div class="lg-row"><button class="btn primary" type="submit">${t.send}</button><button class="lg-back" type="button" hidden>${t.again}</button></div>
    </form>`;
  const form = root.querySelector('form')!;
  const email = root.querySelector<HTMLInputElement>('#lg-e')!, code = root.querySelector<HTMLInputElement>('#lg-c')!;
  const err = root.querySelector<HTMLElement>('.err')!, btn = form.querySelector<HTMLButtonElement>('[type=submit]')!, back = root.querySelector<HTMLButtonElement>('.lg-back')!;
  let stage: 'email' | 'code' = 'email';
  const post = (url: string, data: object) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).then(async r => {
    const d = await r.json();
    // The site is in private preview and this browser hasn't entered the code: go to the code screen.
    if (d?.error === 'preview') location.replace(`${location.pathname}?code=${Date.now()}`);
    return { ok: r.ok, data: d };
  });
  const show = (m: string) => { err.textContent = m; err.hidden = !m; };
  back.addEventListener('click', () => { stage = 'email'; root.querySelector<HTMLElement>('.lg-code')!.hidden = true; root.querySelector<HTMLElement>('.lg-email')!.hidden = false; back.hidden = true; btn.textContent = t.send; email.focus(); show(''); });
  code.addEventListener('input', () => { if (/^\d{6}$/.test(code.value)) form.requestSubmit(); });
  form.addEventListener('submit', async e => {
    e.preventDefault(); show('');
    const label = btn.textContent; btn.textContent = t.busy; btn.disabled = true;
    try {
      if (stage === 'email') {
        const r = await post('/api/auth/request', { email: email.value, lang });
        if (!r.ok) return show(t.errors[r.data?.error] ?? t.fail);
        stage = 'code';
        root.querySelector<HTMLElement>('.lg-sent')!.textContent = t.sent(email.value.trim());
        root.querySelector<HTMLElement>('.lg-email')!.hidden = true; root.querySelector<HTMLElement>('.lg-code')!.hidden = false; back.hidden = false;
        code.value = ''; code.focus();
        btn.textContent = t.verify; return;
      }
      const r = await post('/api/auth/verify', { email: email.value, code: code.value.trim() });
      if (!r.ok) { btn.textContent = label; return show(t.errors[r.data?.error] ?? t.fail); }
      onDone(r.data.user);
    } catch { show(t.fail); }
    finally { btn.disabled = false; if (btn.textContent === t.busy) btn.textContent = label; }
  });
}

export const logout = () => fetch('/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
