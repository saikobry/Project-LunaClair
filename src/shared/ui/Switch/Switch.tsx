import { Switch as AstryxSwitch, type SwitchProps as AstryxSwitchProps } from '@astryxdesign/core/Switch';

export interface SwitchProps extends Omit<AstryxSwitchProps, 'value'> {
  value?: boolean;
  isChecked?: boolean;
}

/**
 * LunaClair Switch — accessible toggle switch adapter over @astryxdesign/core Switch.
 *
 * Exposes accessible toggle switch with label, description, and ARIA attributes.
 */
export function Switch({ isChecked, value, onChange, ...rest }: SwitchProps) {
  const switchValue = isChecked !== undefined ? isChecked : Boolean(value);

  return (
    <AstryxSwitch
      value={switchValue}
      onChange={(checked, e) => onChange?.(checked, e)}
      {...rest}
    />
  );
}

Switch.displayName = 'Switch';
