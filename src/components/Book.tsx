import { ILogEntry } from "../services/FetchService";
import HeaderBookmark from "./HeaderBookmark";
import BottomBar, { LinkLocation } from "./BottomBar";
import { useNavigate } from "react-router-dom";

export default function Book({ pageContent, previous, next, currentlySelectedDay }: { pageContent: any, previous: LinkLocation | undefined, next: LinkLocation | undefined, currentlySelectedDay: ILogEntry | undefined }) {

    const navigate = useNavigate();

    return (
        <>
            <div className="relative flex flex-col h-full w-full">
                <HeaderBookmark
                    isHome={previous !== null && currentlySelectedDay === null}
                    onClick={() => navigate('/Content')}
                />
                <div className="flex-grow min-h-0">
                    {pageContent}
                </div>
                <div className="flex-none">
                    <BottomBar
                        previous={previous}
                        next={next}
                        currentlySelectedDay={currentlySelectedDay}
                    />
                </div>
            </div>
        </>
    )
}