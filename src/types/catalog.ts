export interface Faq {
  id?: string
  question: string
  answer: string
  position?: number
}

export interface AgeRange {
  id: string
  slug: string
  name: string
  minAgeMonths: number | null
  maxAgeMonths: number | null
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Vaccine {
  id: string
  name: string
  description: string
  manufacturer: string
  price: string
  ageRanges: AgeRange[]
  faqs: Faq[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface PackageVaccine {
  quantity: number
  vaccine: Vaccine
}

export interface VaccinePackage {
  id: string
  name: string
  description: string
  price: string
  vaccines: PackageVaccine[]
  faqs: Faq[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
