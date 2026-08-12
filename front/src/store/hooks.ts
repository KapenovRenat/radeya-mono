"use client";

import { useDispatch, useSelector, useStore } from "react-redux";

import type { AppDispatch, AppStore, RootState } from "./index";

/**
 * Типизированные хуки. В компонентах используем только их —
 * тогда типы состояния и действий подставляются сами.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
