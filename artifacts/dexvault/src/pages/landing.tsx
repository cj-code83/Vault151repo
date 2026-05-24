import { useAuth } from '@/hooks/use-auth';
import { AuthForm } from '@/components/auth-form';
import { Redirect } from 'wouter';

const SHOWCASE_CARDS = [
  {
    id: 'base1-4',
    name: 'Charizard',
    src: 'https://images.pokemontcg.io/base1/4_hires.png',
    rotate: '-6deg',
    top: '6%',
    left: '4%',
    z: 20,
  },
  {
    id: 'base1-10',
    name: 'Mewtwo',
    src: 'https://images.pokemontcg.io/base1/10_hires.png',
    rotate: '3deg',
    top: '4%',
    left: '36%',
    z: 10,
  },
  {
    id: 'swsh4-20',
    name: 'Charizard VMAX',
    src: 'https://images.pokemontcg.io/swsh4/20_hires.png',
    rotate: '8deg',
    top: '2%',
    left: '62%',
    z: 5,
  },
  {
    id: 'base1-2',
    name: 'Blastoise',
    src: 'https://images.pokemontcg.io/base1/2_hires.png',
    rotate: '-4deg',
    top: '42%',
    left: '0%',
    z: 15,
  },
  {
    id: 'base1-15',
    name: 'Venusaur',
    src: 'https://images.pokemontcg.io/base1/15_hires.png',
    rotate: '5deg',
    top: '44%',
    left: '30%',
    z: 25,
  },
  {
    id: 'sv3pt5-6',
    name: 'Charizard ex 151',
    src: 'https://images.pokemontcg.io/sv3pt5/6_hires.png',
    rotate: '-3deg',
    top: '40%',
    left: '60%',
    z: 8,
  },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-8">
            <img
              src="/vault151-logo.png"
              alt="Vault151 logo"
              width={44}
              height={44}
              className="object-contain"
            />
            <span className="font-bold text-3xl tracking-tight">
              <span className="text-foreground">Vault</span>
              <span className="text-red-600 dark:text-red-500">151</span>
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
            Track Every Card <br className="hidden md:block" />
            <span className="text-primary">You Catch.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-md leading-relaxed">
            The collector's obsession tool. A premium dashboard to track your Pokémon TCG pulls, hunts, and grails.
          </p>
          <AuthForm />
        </div>
      </div>

      <div className="hidden md:block flex-1 relative overflow-hidden border-l border-border bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-900/80" />
        <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-red-600/20 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-600/15 rounded-full blur-[80px]" />

        <div className="absolute inset-0">
          {SHOWCASE_CARDS.map((card) => (
            <div
              key={card.id}
              className="absolute w-[160px] transition-transform duration-300 hover:scale-105 hover:z-50"
              style={{
                top: card.top,
                left: card.left,
                transform: `rotate(${card.rotate})`,
                zIndex: card.z,
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
              }}
            >
              <img
                src={card.src}
                alt={card.name}
                className="w-full rounded-xl"
                loading="lazy"
              />
            </div>
          ))}
        </div>

        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <p className="text-slate-400 text-sm font-medium tracking-wide">
            Your collection. Your grails.
          </p>
        </div>
      </div>
    </div>
  );
}
