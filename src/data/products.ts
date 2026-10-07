import type { Product } from '../types'

export const products: Product[] = [
  { id: 'coffee', name: 'Brewed Coffee', description: 'Freshly brewed campus blend', category: 'Drinks', price: 4500, accent: '#d68147', initials: 'BC' },
  { id: 'sandwich', name: 'Club Sandwich', description: 'Toasted and made fresh', category: 'Meals', price: 5000, accent: '#6d9b67', initials: 'CS' },
  { id: 'soft-drink', name: 'Soft Drink', description: 'Chilled 330 ml can', category: 'Drinks', price: 3500, accent: '#d65757', initials: 'SD' },
  { id: 'cookies', name: 'Chocolate Cookies', description: 'Pack of three cookies', category: 'Snacks', price: 2500, accent: '#a97954', initials: 'CC' },
  { id: 'water', name: 'Bottled Water', description: 'Purified water, 500 ml', category: 'Drinks', price: 2000, accent: '#4f91b7', initials: 'BW' },
  { id: 'chocolate', name: 'Chocolate Bar', description: 'Classic milk chocolate', category: 'Snacks', price: 2500, accent: '#765342', initials: 'CB' },
  { id: 'rice-meal', name: 'Chicken Rice Meal', description: 'Chicken, rice, and vegetables', category: 'Meals', price: 9500, accent: '#dc9f3f', initials: 'RM' },
  { id: 'notebook', name: 'Campus Notebook', description: '80-page ruled notebook', category: 'Merchandise', price: 6000, accent: '#765ba7', initials: 'CN' },
]
