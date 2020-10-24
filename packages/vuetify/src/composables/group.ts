// Setup
import type { Ref, InjectionKey, SetupContext } from 'vue'
import { ref, provide, inject, computed, onBeforeUnmount, getCurrentInstance } from 'vue'
import { wrapInArray } from '../util/helpers'
import { consoleWarn } from '../util/console'
import { useProxiedModel } from './proxiedModel'

// Types
interface GroupItem {
  id: string | number
  value: Ref<any>
}

interface GroupProps { [key: string]: any, modelValue?: any, multiple?: boolean, mandatory?: boolean, max?: number }

interface GroupProvide {
  register: (item: GroupItem) => void
  unregister: (id: string | number) => void
  toggle: (id: string | number) => void
  selected: Ref<any[]>
  isSelected: (id: string | number) => boolean
  prev: () => void
  next: () => void
  items: Ref<GroupItem[]>
}

export function useGroupItem (
  props: { value?: any },
  injectKey: InjectionKey<GroupProvide>,
) {
  const group = inject(injectKey)
  const vm = getCurrentInstance()

  if (!vm) {
    throw new Error('Could not find current instance')
  }

  if (!group) {
    throw new Error(`Could not find useGroup injection for symbol ${injectKey}`)
  }

  const id = vm.uid

  group.register({
    id,
    value: computed(() => props.value),
  })

  onBeforeUnmount(() => {
    group.unregister(id)
  })

  const isSelected = computed(() => {
    return group.isSelected(id)
  })

  return {
    isSelected,
    toggle: () => group.toggle(id),
  }
}

const getIds = (items: GroupItem[], selection: any[]) => {
  const ids = []

  for (const item of items) {
    if ((item.value != null && selection.includes(item.value)) || selection.includes(item.id)) {
      ids.push(item.id)
    }
  }

  return ids
}

const getValues = (items: GroupItem[], ids: any[]) => {
  const values = []

  for (const item of items) {
    if (ids.includes(item.id)) {
      values.push(item.value != null ? item.value : item.id)
    }
  }

  return values
}

export function useGroup (
  props: GroupProps,
  context: SetupContext<any>,
  injectKey: InjectionKey<GroupProvide>
) {
  const items = ref<GroupItem[]>([])
  const selected = useProxiedModel(
    props,
    context,
    'modelValue',
    [],
    v => {
      if (v == null) return []

      return getIds(items.value, wrapInArray(v))
    },
    v => {
      const arr = getValues(items.value, v)

      return props.multiple ? arr : arr[0]
    }
  )

  function register (item: GroupItem) {
    items.value.push(item)

    // If mandatory and nothing is selected,
    // then select this item
    if (props.mandatory && !selected.value.length) {
      selected.value = [item.id]
    }
  }

  function unregister (id: string | number) {
    selected.value = selected.value.filter(v => v !== id)

    if (props.mandatory && !selected.value.length) {
      selected.value = [items.value[items.value.length - 1].id]
    }

    items.value = items.value.filter(item => item.id !== id)
  }

  function toggle (id: string | number) {
    if (props.multiple) {
      const internalValue = selected.value.slice()
      const index = internalValue.findIndex(v => v === id)

      // We can't remove value if group is
      // mandatory, value already exists,
      // and it is the only value
      if (
        props.mandatory &&
        index > -1 &&
        internalValue.length - 1 < 1
      ) return

      // We can't add value if it would
      // cause max limit to be exceeded
      if (
        props.max != null &&
        index < 0 &&
        internalValue.length + 1 > props.max
      ) return

      if (index > -1) internalValue.splice(index, 1)
      else internalValue.push(id)

      selected.value = internalValue
    } else {
      const isSame = selected.value.includes(id)

      if (props.mandatory && isSame) return

      selected.value = isSame ? [] : [id]
    }
  }

  function getOffsetId (offset: number) {
    // getting an offset from selected value obviously won't work with multiple values
    if (props.multiple) consoleWarn('This method is not supported when using "multiple" prop')

    // If there is nothing selected, then next value is first item
    if (!selected.value.length) return items.value[0].id

    const currentId = selected.value[0]
    const currentIndex = items.value.findIndex(i => i.id === currentId)
    const newIndex = (currentIndex + offset) % items.value.length

    return items.value[newIndex].id
  }

  const state = {
    register,
    unregister,
    selected,
    items,
    toggle,
    prev: () => selected.value = [getOffsetId(items.value.length - 1)],
    next: () => selected.value = [getOffsetId(1)],
    step: (steps: number) => selected.value = [getOffsetId(steps)],
    isSelected: (id: string | number) => selected.value.includes(id),
  }

  provide(injectKey, state)

  return state
}
