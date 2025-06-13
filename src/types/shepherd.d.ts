/**
 * Type declarations for Shepherd.js
 */

declare module 'shepherd.js' {
  namespace Shepherd {
    interface StepOptions {
      id?: string
      text?: string | HTMLElement | (() => string | HTMLElement)
      title?: string
      attachTo?: {
        element: string | HTMLElement
        on: string
      }
      beforeShowPromise?: () => Promise<void>
      buttons?: Array<{
        text: string
        action?: () => void
        classes?: string
        secondary?: boolean
      }>
      advanceOn?: {
        selector: string
        event: string
      }
      classes?: string
      highlightClass?: string
      scrollTo?: boolean
      cancelIcon?: {
        enabled: boolean
      }
      when?: {
        [event: string]: () => void | (() => void)
      }
    }

    interface TourOptions {
      defaultStepOptions?: Partial<StepOptions>
      useModalOverlay?: boolean
      confirmCancel?: boolean
      confirmCancelMessage?: string
      exitOnEsc?: boolean
      keyboardNavigation?: boolean
      stepsContainer?: HTMLElement
      modalContainer?: string | HTMLElement
      steps?: StepOptions[]
    }

    class Tour {
      constructor(options: TourOptions)
      addStep(options: StepOptions): Tour
      addStep(id: string, options: StepOptions): Tour
      addSteps(steps: StepOptions[]): Tour
      back(): void
      cancel(): void
      complete(): void
      getById(id: string): Step
      getCurrentStep(): Step
      hide(): void
      next: () => void
      on(event: string, handler: (...args: any[]) => void): void
      off(event: string): void
      once(event: string, handler: (...args: any[]) => void): void
      removeStep(id: string): void
      show(id?: string): void
      start(): void
    }

    class Step {
      constructor(tour: Tour, options: StepOptions)
      hide(): void
      show(): void
      isOpen(): boolean
      complete(): void
      cancel(): void
      scrollTo(): void
      destroy(): void
    }
  }

  export default Shepherd
}
