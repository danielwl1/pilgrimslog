'use client';
import { useEffect, useRef } from 'react';

import { useContext, useState } from 'react';
import { BookPageIndex } from '@/util/BookPageIndex';
import DaySlider from './DaySlider';
import ControlledMap from './map/Map';
import { BookContext } from './Main';

type DrawerSnap = 'closed' | 'peek' | 'open';
const SNAP_ORDER: DrawerSnap[] = ['closed', 'peek', 'open'];

// Reserve room above the drawer for the page title/nav on short screens.
const MIN_RESERVED_FOR_CONTENT = 120;
const OPEN_FRACTION = 0.8;
const PEEK_FRACTION = 0.4;
const CLOSED_HEIGHT = 240;

// Everything in the drawer that isn't the map: padding + drag handle row +
// day/distance label row + slider (DaySlider is h-[100px]). Used to size the
// map so it fills the remaining drawer height. Keep in sync with the markup
// below and the .map-description height in globals.scss.
const DRAWER_CHROME = 176;

// How far a real drag has to move before it counts as a drag (vs a tap).
const DRAG_THRESHOLD = 8;
// Momentum window (ms) — release velocity is projected this far to decide
// whether a flick should carry past the nearest snap point.
const PROJECTION_MS = 120;

export default function PullOutDrawer() {
    const { setDisplayed, displayed, entries } = useContext(BookContext)!;
    const [snap, setSnap] = useState<DrawerSnap>('closed');

    const drawerRef = useRef<HTMLDivElement>(null);
    const dragStartY = useRef(0);
    const dragStartHeight = useRef(0);
    const lastY = useRef(0);
    const lastT = useRef(0);
    const velocity = useRef(0); // px/ms of height change; positive = opening
    const didDrag = useRef(false);

    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== 'undefined' ? window.innerHeight : 900,
    );

    useEffect(() => {
        const onResize = () => setViewportHeight(window.innerHeight);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const maxDrawerHeight = Math.max(
        CLOSED_HEIGHT,
        viewportHeight - MIN_RESERVED_FOR_CONTENT,
    );

    const snapHeights: Record<DrawerSnap, number> = {
        closed: CLOSED_HEIGHT,
        peek: Math.min(viewportHeight * PEEK_FRACTION, maxDrawerHeight),
        open: Math.min(viewportHeight * OPEN_FRACTION, maxDrawerHeight),
    };

    const isHome = displayed.equals(BookPageIndex.homepage(entries));

    // The homepage always shows the full map; otherwise the drawer stays at
    // whatever snap position the user dragged it to. Scrubbing the slider does
    // NOT change the drawer height — it only updates the displayed entry.
    const effectiveSnap: DrawerSnap = isHome ? 'open' : snap;
    const isOpen = effectiveSnap !== 'closed';
    const mapExpanded = effectiveSnap === 'open';

    // Size the map to fill whatever height the drawer currently has.
    const mapHeight = Math.max(100, snapHeights[effectiveSnap] - DRAWER_CHROME);

    // Called as the slider is scrubbed. Updates which entry is shown (map
    // center + overlay text) without touching the drawer's snap position.
    const onScrub = (entry: BookPageIndex | null) => {
        if (entry !== null) {
            setDisplayed(entry);
        }
    };

    function nearestSnap(height: number): DrawerSnap {
        return SNAP_ORDER.reduce((closest, candidate) =>
            Math.abs(snapHeights[candidate] - height) <
            Math.abs(snapHeights[closest] - height)
                ? candidate
                : closest,
        );
    }

    function handleDragStart(e: React.PointerEvent) {
        // The homepage drawer is fixed (always open, content-driven); dragging
        // it would leave a stale imperative height that React won't reconcile.
        if (isHome || !drawerRef.current) return;
        dragStartY.current = e.clientY;
        dragStartHeight.current =
            drawerRef.current.getBoundingClientRect().height;
        lastY.current = e.clientY;
        lastT.current = performance.now();
        velocity.current = 0;
        didDrag.current = false;
        drawerRef.current.style.transition = 'none';
        document.addEventListener('pointermove', handleDragMove);
        document.addEventListener('pointerup', handleDragEnd);
    }

    function handleDragMove(e: PointerEvent) {
        if (!drawerRef.current) return;

        const now = performance.now();
        const dt = now - lastT.current;
        if (dt > 0) {
            // Positive = moving up = drawer growing.
            velocity.current = (lastY.current - e.clientY) / dt;
        }
        lastY.current = e.clientY;
        lastT.current = now;

        const delta = dragStartY.current - e.clientY; // positive = dragging up
        if (Math.abs(delta) > DRAG_THRESHOLD) didDrag.current = true;

        const newHeight = Math.min(
            maxDrawerHeight,
            Math.max(CLOSED_HEIGHT * 0.6, dragStartHeight.current + delta),
        );
        drawerRef.current.style.height = `${newHeight}px`;
    }

    function handleDragEnd() {
        if (!drawerRef.current) return;

        document.removeEventListener('pointermove', handleDragMove);
        document.removeEventListener('pointerup', handleDragEnd);

        drawerRef.current.style.transition = '';

        if (!didDrag.current) {
            // A tap: let the height snap back to the effective position; the
            // handle's onClick handles the closed <-> open toggle.
            drawerRef.current.style.height = `${snapHeights[effectiveSnap]}px`;
            return;
        }

        // Project the release point by its velocity so a flick can carry past
        // the nearest snap point (Google-Maps style), then settle on whichever
        // of closed/peek/open is closest to that projected height.
        const height = drawerRef.current.getBoundingClientRect().height;
        const projected = height + velocity.current * PROJECTION_MS;
        const newSnap = nearestSnap(projected);

        setSnap(newSnap);
        drawerRef.current.style.height = `${snapHeights[newSnap]}px`;
    }

    function handleHandleClick() {
        if (didDrag.current) return; // the pointerup that ended a drag
        setSnap((prev) => (prev === 'closed' ? 'open' : 'closed'));
    }

    return (
        <div
            ref={drawerRef}
            className={
                'drawer ' + (isOpen ? 'open' : '') + (isHome ? ' home' : '')
            }
            onPointerDown={handleDragStart}
            style={{
                zIndex: 1100,
                // On the homepage the drawer is content-driven (the map uses its
                // own CSS height); elsewhere the snap position fixes the height.
                height: isHome ? undefined : snapHeights[effectiveSnap],
            }}
        >
            <div
                className="flex justify-center pt-1 pb-4 cursor-grab touch-none"
                onClick={handleHandleClick}
            >
                <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            <ControlledMap
                expanded={mapExpanded}
                mapHeight={isHome ? undefined : mapHeight}
                descriptionOverlay={effectiveSnap === 'closed'}
                expand={() => setSnap('open')}
            />
            <DaySlider activeValue={onScrub} />
        </div>
    );
}
