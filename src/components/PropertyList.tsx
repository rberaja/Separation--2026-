import { useApp, useSortedProperties } from '../store/AppContext';
import { PropertyCard } from './PropertyCard';
import { SectionHeading } from './ui/SectionHeading';

export function PropertyList() {
  const { dispatch } = useApp();
  const properties = useSortedProperties();

  return (
    <section>
      <SectionHeading
        action={
          <button
            type="button"
            className="tool-btn text-[0.6rem] tracking-[0.1em] px-2.5 py-1 hover:bg-surface2"
            onClick={() => dispatch({ type: 'property/add' })}
          >
            + Add Property
          </button>
        }
      >
        A. Properties
      </SectionHeading>

      {properties.length === 0 ? (
        <div className="text-center px-5 py-11 text-muted2 font-mono text-[0.73rem] tracking-[0.04em] leading-loose">
          No properties yet.
          <br />
          Upload an Excel file above, or click <strong>+ Add Property</strong>.
        </div>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </section>
  );
}
