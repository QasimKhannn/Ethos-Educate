import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import type { InputHTMLAttributes } from 'react';
import type { TranslationKeys } from '~/hooks';

import { useLocalize } from '~/hooks';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  id: string;
  label: TranslationKeys;
  hasError?: boolean;
};

const inputClassName =
  'webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pe-12 pt-3 text-text-primary duration-200 focus:border-[#DAAC60] focus:outline-none';

const labelClassName =
  'absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-[#DAAC60] rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4';

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    { id, label, hasError, className = '', autoComplete = 'current-password', ...inputProps },
    ref,
  ) => {
    const localize = useLocalize();
    const [passwordVisible, setPasswordVisible] = useState(false);
    const toggleLabel = passwordVisible
      ? localize('com_ui_hide_password')
      : localize('com_ui_show_password');

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={passwordVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-label={localize(label)}
          aria-invalid={hasError}
          className={`${inputClassName} ${className}`.trim()}
          placeholder=" "
          {...inputProps}
        />
        <label htmlFor={id} className={labelClassName}>
          {localize(label)}
        </label>
        <button
          type="button"
          aria-label={toggleLabel}
          aria-pressed={passwordVisible}
          onClick={() => setPasswordVisible((visible) => !visible)}
          className="absolute end-3 top-1/2 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary-alt transition-colors hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-[#DAAC60]/70"
        >
          {passwordVisible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
