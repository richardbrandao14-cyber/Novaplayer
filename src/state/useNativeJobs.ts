import { create } from "zustand";
import type { NativeJob } from "../domain/native/types";
interface JobsState {
  jobs: Record<string, NativeJob>;
  remember: (job: NativeJob) => void;
}
// Somente IDs e contadores públicos; não persistir credenciais nem detalhes de requisições.
export const useNativeJobs = create<JobsState>((set) => ({
  jobs: {},
  remember: (job) =>
    set((state) => ({ jobs: { ...state.jobs, [job.sourceId]: job } })),
}));
