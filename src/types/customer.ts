export interface CustomerProfile {
  id: string
  name: string
  phone: string
  createdAt: string
  updatedAt: string
}

export interface Dependent {
  id: string
  name: string
  birthDate: string
  createdAt: string
  updatedAt: string
}

export interface ProfileInput {
  name: string
  phone: string
}

export interface DependentInput {
  name: string
  birthDate: string
}

export type DependentUpdate = Partial<DependentInput>
