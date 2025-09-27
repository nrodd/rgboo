import ColorForm from '../components/ColorForm'

export const MainContent = () => (
    <div id="main-content" className="flex flex-col justify-center mt-12 mb-auto px-12 space-y-18">
        {/* placeholder until we get logo :) */}
        <div className="mx-auto w-18 aspect-square bg-bone" />
        <div className="space-y-12">
            {/* placeholder until we get stream up :) */}
            <div className="w-100% aspect-3/2 bg-bone" />
            <ColorForm />
        </div>
    </div>
)