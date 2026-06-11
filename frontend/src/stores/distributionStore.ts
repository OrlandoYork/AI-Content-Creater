import { create } from 'zustand';
import type { Distribution, DistributionCreate } from '../types';
import * as distributionApi from '../services/distributionApi';

interface DistributionStore {
  distributions: Distribution[];
  distributionsTotal: number;
  distributionsLoading: boolean;

  currentDistribution: Distribution | null;
  currentDistributionLoading: boolean;

  calendarData: Record<string, unknown> | null;

  loadDistributions: (params?: { content_id?: number; platform?: string; status?: string; page?: number; page_size?: number }) => Promise<void>;
  createDistribution: (data: DistributionCreate) => Promise<Distribution>;
  loadDistributionDetail: (id: number) => Promise<void>;
  updateDistribution: (id: number, data: Record<string, unknown>) => Promise<void>;
  batchDistribute: (contentId: number, platforms: string[]) => Promise<Distribution[]>;
  publishDistribution: (id: number) => Promise<Distribution>;
  cancelDistribution: (id: number) => Promise<Distribution>;
  loadCalendar: (year: number, month: number) => Promise<void>;
  clearCurrentDistribution: () => void;
}

export const useDistributionStore = create<DistributionStore>((set) => ({
  distributions: [],
  distributionsTotal: 0,
  distributionsLoading: false,

  currentDistribution: null,
  currentDistributionLoading: false,

  calendarData: null,

  loadDistributions: async (params) => {
    set({ distributionsLoading: true });
    try {
      const res = await distributionApi.fetchDistributions(params);
      set({ distributions: res.items, distributionsTotal: res.total });
    } finally {
      set({ distributionsLoading: false });
    }
  },

  createDistribution: async (data) => {
    const dist = await distributionApi.createDistribution(data);
    return dist;
  },

  loadDistributionDetail: async (id) => {
    set({ currentDistributionLoading: true });
    try {
      const dist = await distributionApi.fetchDistributionDetail(id);
      set({ currentDistribution: dist });
    } finally {
      set({ currentDistributionLoading: false });
    }
  },

  updateDistribution: async (id, data) => {
    const updated = await distributionApi.updateDistribution(id, data as Parameters<typeof distributionApi.updateDistribution>[1]);
    set({ currentDistribution: updated });
  },

  batchDistribute: async (contentId, platforms) => {
    const dists = await distributionApi.batchDistribute(contentId, platforms);
    return dists;
  },

  publishDistribution: async (id) => {
    const dist = await distributionApi.publishDistribution(id);
    return dist;
  },

  cancelDistribution: async (id) => {
    const dist = await distributionApi.cancelDistribution(id);
    return dist;
  },

  loadCalendar: async (year, month) => {
    const data = await distributionApi.fetchCalendar(year, month);
    set({ calendarData: data });
  },

  clearCurrentDistribution: () => set({ currentDistribution: null }),
}));
