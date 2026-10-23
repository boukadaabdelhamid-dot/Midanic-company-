import { useState } from 'react';
import './_group.css';
import { AdminLayout } from './_shared/CurrentLayout';
import { CurrentErp } from './_shared/CurrentErp';
export function Current() {
const [notice,setNotice] = useState('');
return <div className="company-admin-prototype dark min-h-screen bg-background text-foreground">
<div className="flex h-16 items-center justify-between border-b px-5 text-sm"><span className="font-semibold">MIDANIC</span><span className="text-muted-foreground">Current interface · Demo data only</span></div>
<AdminLayout><CurrentErp onAction={setNotice} /></AdminLayout>
{notice && <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-card p-4 shadow-xl"><p className="font-medium">{notice}</p><p className="mt-1 text-sm text-muted-foreground">Reference preview only. No real account is modified.</p><button className="mt-3 text-sm text-primary" onClick={()=>setNotice('')}>Close</button></div>}
</div>;
}
