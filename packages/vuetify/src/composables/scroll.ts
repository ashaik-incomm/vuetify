import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  Ref,
  ref,
  watch,
  onMounted,
} from 'vue'
import { consoleWarn } from '../util/console'
import { passiveEventOptions } from '../util/events'

// Types
export interface ScrollProps {
  scrollTarget?: string
  scrollThreshold?: string | number
}

export interface ThresholdMetCallbackData {
  isScrollingUp: boolean
  currentThreshold: number
  savedScroll: Ref<number>
}

// Props
export function scrollProps (
  defaults: Partial<ScrollProps> = {}
) {
  return {
    scrollTarget: {
      type: String,
      default: defaults.scrollTarget,
    },
    scrollThreshold: {
      type: [String, Number],
      default: defaults.scrollThreshold,
    },
  }
}

interface ScrollArguments {
  thresholdMetCallback?: (data: ThresholdMetCallbackData) => void
  scrollThreshold?: Readonly<Ref<number>>
  canScroll?: Readonly<Ref<boolean>>
}

export function useScroll (
  props: ScrollProps,
  args: ScrollArguments = {},
) {
  const { thresholdMetCallback, scrollThreshold, canScroll } = args
  let previousScroll = 0
  const target = ref<Element | Window | null>(null)
  const currentScroll = ref(0)
  const savedScroll = ref(0)
  const currentThreshold = ref(0)
  const isScrollActive = ref(false)
  const isScrollingUp = ref(false)

  const computedScrollThreshold = computed(() => {
    if (props.scrollThreshold != null) return Number(props.scrollThreshold)

    if (scrollThreshold != null) return scrollThreshold.value

    return 300
  })

  const onScroll = () => {
    const targetEl = target.value

    if (!targetEl || (canScroll && !canScroll.value)) return

    previousScroll = currentScroll.value
    currentScroll.value = ('window' in targetEl) ? (targetEl as Window).pageYOffset : (targetEl as Element).scrollTop

    isScrollingUp.value = currentScroll.value < previousScroll
    currentThreshold.value = Math.abs(currentScroll.value - computedScrollThreshold.value)
  }

  watch(isScrollingUp, () => (savedScroll.value = savedScroll.value || currentScroll.value), {
    immediate: true,
  })

  watch(isScrollActive, () => (savedScroll.value = 0), {
    immediate: true,
  })

  onMounted(() => {
    watch(() => props.scrollTarget, () => {
      const newTarget = props.scrollTarget ? document.querySelector(props.scrollTarget) : window

      if (!newTarget) {
        consoleWarn(`Unable to locate element with identifier ${props.scrollTarget}`, getCurrentInstance())
        return
      }

      if (newTarget === target.value) return

      target.value && target.value.removeEventListener('scroll', onScroll, passiveEventOptions())
      target.value = newTarget
      target.value.addEventListener('scroll', onScroll, passiveEventOptions())
    }, {
      immediate: true,
    })
  })


  thresholdMetCallback && watch(() => (
    Math.abs(currentScroll.value - savedScroll.value) > computedScrollThreshold.value
  ), thresholdMet => {
    thresholdMet && thresholdMetCallback({
      currentThreshold: currentThreshold.value,
      isScrollingUp: isScrollingUp.value,
      savedScroll,
    })
  }, {
    immediate: true,
  })

  // Do we need this? If yes - seems that
  // there's no need to expose onScroll
  canScroll && watch(canScroll, onScroll, {
    immediate: true,
  })

  // TODO: get rid of getCurrentInstance, it is
  // required only for tests to avoid warning
  getCurrentInstance() && onBeforeUnmount(() => {
    target.value && target.value.removeEventListener('scroll', onScroll, passiveEventOptions())
  })

  return {
    isScrollActive,

    // required only for testing
    // probably can be removed
    // later (2 chars chlng)
    isScrollingUp,
    savedScroll,
  }
}
