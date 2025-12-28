import { useCallback, useMemo } from 'react';
import { useCartStore } from '../stores/useCartStore';
import type { CartItem } from '../types/ecommerce';

type StoreState = Parameters<typeof useCartStore>[0] extends (state: infer S) => any ? S : never;

type ItemId = CartItem extends { id: infer Id } ? Id : string;

type AddItemArg =
  | CartItem
  | (CartItem extends { product: infer P } ? P : never)
  | (CartItem extends { productId: infer PID } ? { productId: PID } : never);

type AddItemFn =
  StoreState extends { addItem: (...args: infer A) => any }
    ? (...args: A) => void
    : (item: AddItemArg, qty?: number) => void;

type RemoveItemFn =
  StoreState extends { removeItem: (...args: infer A) => any }
    ? (...args: A) => void
    : (id: ItemId) => void;

type UpdateQtyFn =
  StoreState extends { updateQty: (...args: infer A) => any }
    ? (...args: A) => void
    : (id: ItemId, qty: number) => void;

type ClearFn =
  StoreState extends { clear: (...args: infer A) => any }
    ? (...args: A) => void
    : () => void;

/**
 * 购物车 Hook：封装对 zustand 购物车 store 的选择器与常用派发方法。
 *
 * - 仅从购物车 store 与电商类型导入，避免组件层耦合
 * - 返回稳定对象结构，并对派发方法做 memo
 */
export function useCart(): {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: AddItemFn;
  removeItem: RemoveItemFn;
  updateQty: UpdateQtyFn;
  clear: ClearFn;
} {
  const items = useCartStore((s: any) => (Array.isArray(s.items) ? (s.items as CartItem[]) : []));
  const count = useCartStore((s: any) => {
    if (typeof s.count === 'number') return s.count as number;
    const its: CartItem[] = Array.isArray(s.items) ? s.items : [];
    return its.reduce((acc, it: any) => acc + (typeof it?.qty === 'number' ? it.qty : 0), 0);
  });
  const subtotal = useCartStore((s: any) => {
    if (typeof s.subtotal === 'number') return s.subtotal as number;
    const its: CartItem[] = Array.isArray(s.items) ? s.items : [];
    return its.reduce((acc, it: any) => {
      const qty = typeof it?.qty === 'number' ? it.qty : 0;
      const price = typeof it?.price === 'number' ? it.price : typeof it?.product?.price === 'number' ? it.product.price : 0;
      return acc + qty * price;
    }, 0);
  });

  const addItemRaw = useCartStore((s: any) => s.addItem) as AddItemFn;
  const removeItemRaw = useCartStore((s: any) => s.removeItem) as RemoveItemFn;
  const updateQtyRaw = useCartStore((s: any) => s.updateQty) as UpdateQtyFn;
  const clearRaw = useCartStore((s: any) => s.clear) as ClearFn;

  const addItem = useCallback((...args: any[]) => addItemRaw?.(...args), [addItemRaw]) as AddItemFn;
  const removeItem = useCallback((...args: any[]) => removeItemRaw?.(...args), [removeItemRaw]) as RemoveItemFn;
  const updateQty = useCallback((...args: any[]) => updateQtyRaw?.(...args), [updateQtyRaw]) as UpdateQtyFn;
  const clear = useCallback((...args: any[]) => clearRaw?.(...args), [clearRaw]) as ClearFn;

  return useMemo(
    () => ({
      items,
      count,
      subtotal,
      addItem,
      removeItem,
      updateQty,
      clear,
    }),
    [items, count, subtotal, addItem, removeItem, updateQty, clear],
  );
}