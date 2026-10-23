import './_group.css';
import Home from './_shared/Home';
import {Navbar} from './_shared/Navbar';
import {Footer} from './_shared/Footer';
import {PreviewProvider} from './_shared/stubs';
export function Current(){return <PreviewProvider><div className='bg-primary py-1 text-center text-[11px] text-primary-foreground'>Design reference · Sample products · No real orders</div><Navbar/><Home/><Footer/></PreviewProvider>;}
