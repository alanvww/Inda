import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';


export default function Navbar() {
    const [hover, setHover] = useState(false);

    const handleScreenshot = () => {
        html2canvas(document.body).then((canvas) => {
            const link = document.createElement('a');
            link.download = `screenshot-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    };

    return (
        <nav className=" m-4 px-4 py-4 border-b-2 border-stone-900 flex">
            <motion.div
                className="bg-stone-900 text-white p-2  md:text-3xl font-bold cursor-pointer h-12 flex items-center"
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                <p className='my-auto h-8'>
                    0{hover ? 'x' : '.'}0 I
                    <AnimatePresence>
                        {hover ? (
                            <motion.span
                                initial={{ fontSize: '0em' }}
                                animate={{ fontSize: '1em' }}
                                exit={{ fontSize: '0em' }}
                                transition={{ duration: 0.5, delay: 0.3 }}
                                className='font-light my-auto'
                            >
                                {` `}
                            </motion.span>
                        ) : ''}
                    </AnimatePresence>
                    n
                    <AnimatePresence>
                        {hover ? (
                            <motion.span
                                initial={{ fontSize: '0em' }}
                                animate={{ fontSize: '1em' }}
                                exit={{ fontSize: '0em' }}
                                transition={{ duration: 0.5, delay: 0.5 }}
                                className='font-light my-auto'
                            >
                                {`eed to `}
                            </motion.span>
                        ) : ''}
                    </AnimatePresence>
                    d
                    <AnimatePresence>
                        {hover ? (
                            <motion.span
                                initial={{ fontSize: '0em' }}
                                animate={{ fontSize: '1em' }}
                                exit={{ fontSize: '0em' }}
                                transition={{ duration: 0.5, delay: 0.7 }}
                                className='font-light my-auto'
                            >
                                {`o these `}
                            </motion.span>
                        ) : ''}
                    </AnimatePresence>
                    a
                    <AnimatePresence>
                        {hover ? (
                            <motion.span
                                initial={{ fontSize: '0em' }}
                                animate={{ fontSize: '1em' }}
                                exit={{ fontSize: '0em' }}
                                transition={{ duration: 0.5, delay: 0.9 }}
                                className='font-light my-auto'
                            >
                                ll, so don't f**king bother me.
                            </motion.span>
                        ) : ''}
                    </AnimatePresence>
                </p>
            </motion.div>
            <button
                onClick={handleScreenshot}
                className="bg-stone-900 text-white px-4 py-2 ml-auto"
            >
            Save as Image
            </button>
        </nav>
    );
};