import { useEffect, useRef } from 'react';

/**
 * Controlled 6-digit OTP field. Mirrors initOTPInputs()/getOTPValue()
 * behaviour: auto-advance, backspace-to-previous, and paste support.
 */
export default function OtpInput({ value, onChange, autoFocus }) {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setDigit(i, v) {
    const next = digits.slice();
    next[i] = v;
    onChange(next.join(''));
  }

  function handleInput(i, e) {
    const v = e.target.value.replace(/\D/g, '').charAt(0) || '';
    setDigit(i, v);
    if (v && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(i, e) {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
    const next = digits.slice();
    paste.split('').forEach((ch, j) => { if (i + j < 6) next[i + j] = ch; });
    onChange(next.join(''));
    const last = Math.min(i + paste.length, 5);
    refs.current[last]?.focus();
  }

  return (
    <div className="otp-row">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`otp-digit ${d ? 'filled' : ''}`}
          type="text"
          maxLength={1}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={d}
          onChange={(e) => handleInput(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
        />
      ))}
    </div>
  );
}
