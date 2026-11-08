import { redirect } from 'next/navigation';

// Catalogs moved to /admin/catalogs. This page becomes the product specifications screen in task 7.
export default function AdminProductsPage() {
  redirect('/admin/catalogs');
}
