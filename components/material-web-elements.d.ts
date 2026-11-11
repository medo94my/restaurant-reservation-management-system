import type { HTMLAttributes } from 'react'

type MaterialWebElementProps = HTMLAttributes<HTMLElement> & Record<string, unknown>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MaterialWebElementProps
      'md-outlined-button': MaterialWebElementProps
      'md-text-button': MaterialWebElementProps
      'md-icon-button': MaterialWebElementProps
      'md-icon': MaterialWebElementProps
      'md-filled-text-field': MaterialWebElementProps
      'md-outlined-text-field': MaterialWebElementProps
      'md-checkbox': MaterialWebElementProps
      'md-radio': MaterialWebElementProps
      'md-divider': MaterialWebElementProps
      'md-switch': MaterialWebElementProps
      'md-slider': MaterialWebElementProps
      'md-chip-set': MaterialWebElementProps
      'md-filter-chip': MaterialWebElementProps
      'md-tabs': MaterialWebElementProps
      'md-primary-tab': MaterialWebElementProps
      'md-linear-progress': MaterialWebElementProps
      'md-fab': MaterialWebElementProps
    }
  }
}
