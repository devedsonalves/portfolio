// Formulário de contato: foco, preenchido, erro por campo, enviando e enviado (o envio ainda é fictício).
// Cada campo é validado pelo tipo do <input>: type="email" confere o e-mail, inputmode="url" confere o endereço,
// os outros só pedem pelo menos 2 letras. As mensagens vêm do HTML (data-vazio e data-ruim no <input>), com estas
// de reserva; campo opcional leva data-opcional.
import { $, $$, exigir, trocarRotulo } from '../../core/dom.ts';

type Tipo = 'url' | 'email' | 'texto';

const validos: Record<Tipo, (v: string) => boolean> = {
  url: (v) => /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(v.trim()),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  texto: (v) => v.trim().length >= 2,
};
const reserva: Record<Tipo, { vazio: string; ruim: string }> = {
  url: { vazio: 'Diga qual é o seu site.', ruim: 'Confira o endereço (ex.: seusite.com.br).' },
  email: { vazio: 'Preciso do seu e-mail.', ruim: 'Esse e-mail parece incompleto.' },
  texto: { vazio: 'Preencha este campo.', ruim: 'Confira este campo.' },
};
const tipo = (input: HTMLInputElement): Tipo =>
  input.type === 'email' ? 'email' : input.inputMode === 'url' || input.type === 'url' ? 'url' : 'texto';

// "Copiar e-mail": quem não tem programa de e-mail configurado não ganha nada com o mailto
function iniciarCopiar(): void {
  const botao = $<HTMLButtonElement>('[data-copiar]');
  const aviso = $('.contato__copiado');
  if (!botao) return;
  let timer = 0;
  botao.addEventListener('click', () => {
    const texto = botao.dataset.copiar ?? '';
    const avisar = (msg: string): void => {
      if (!aviso) return;
      aviso.textContent = msg;
      aviso.classList.add('is-visivel');
      clearTimeout(timer);
      timer = window.setTimeout(() => aviso.classList.remove('is-visivel'), 2400);
    };
    navigator.clipboard?.writeText(texto)
      .then(() => avisar('Copiado.'))
      .catch(() => avisar(texto));
  });
}

export function iniciarContato(): void {
  iniciarCopiar();
  const form = $<HTMLFormElement>('[data-contato]');
  if (!form) return;
  const campos = $$('.campo', form);
  const botao = exigir('.botao', form);
  const ok = $('[data-email-ok]', form);

  function checar(campo: HTMLElement, mostrar: boolean): boolean {
    const input = exigir<HTMLInputElement>('input', campo);
    const t = tipo(input);
    const v = input.value;
    const vazio = input.dataset.vazio || reserva[t].vazio;
    const ruim = input.dataset.ruim || reserva[t].ruim;
    const msg = !v.trim() ? ('opcional' in input.dataset ? '' : vazio) : !validos[t](v) ? ruim : '';
    if (mostrar) {
      campo.classList.toggle('is-erro', !!msg);
      exigir('.campo__erro', campo).textContent = msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    return !msg;
  }

  for (const campo of campos) {
    const input = exigir<HTMLInputElement>('input', campo);
    input.addEventListener('input', () => {
      campo.classList.toggle('is-cheio', input.value.length > 0);
      if (campo.classList.contains('is-erro')) checar(campo, true);
    });
    input.addEventListener('blur', () => { if (input.value) checar(campo, true); });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let primeiro: HTMLElement | null = null;
    for (const campo of campos) {
      if (checar(campo, true)) continue;
      primeiro ??= campo;
      // tremida: tira a classe, força o reflow e põe de novo
      campo.classList.remove('is-treme');
      void campo.offsetWidth;
      campo.classList.add('is-treme');
    }
    if (primeiro) {
      $('input', primeiro)?.focus();
      return;
    }
    form.classList.add('is-enviando');
    botao.classList.add('is-ocupado');
    trocarRotulo(botao, 'Enviando…');
    setTimeout(() => {
      form.classList.remove('is-enviando');
      if (ok) ok.textContent = $<HTMLInputElement>('input[type="email"]', form)?.value.trim() ?? '';
      form.classList.add('is-enviado');
      // os campos e o botão somem: saem também do Tab e do leitor de tela, e o foco vai para a confirmação
      for (const c of campos) c.inert = true;
      botao.inert = true;
      const confirma = $('.linha-form__ok', form);
      if (confirma) { confirma.tabIndex = -1; confirma.focus(); }
    }, 1100);
  });
}
