import type { TopologyCluster, TopologyView } from './types';
import TroikaText from './TroikaText';

type Props = {
  clusters: TopologyCluster[];
  view: TopologyView;
};

export default function TopologyLabels({ clusters, view }: Props) {
  if (view !== 'decentralized') return null;

  return (
    <>
      {clusters.map((cluster) => (
        <TroikaText
          key={cluster.id}
          text={`[${cluster.name}]`}
          fontSize={0.22}
          position={cluster.position}
          color="#2dd4bf"
          fillOpacity={0.9}
          anchorX="center"
          anchorY="middle"
          maxWidth={5}
        />
      ))}
    </>
  );
}
