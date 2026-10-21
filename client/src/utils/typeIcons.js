// The line-art icon for each MetaFor personality type, with the star for any
// type that doesn't have one yet.
import starIcon from '@/assets/images/personality/star.svg'
import daydreamerIcon from '@/assets/images/personality/types/daydreamer.png'
import poetIcon from '@/assets/images/personality/types/poet.png'
import sparkIcon from '@/assets/images/personality/types/spark.png'
import stormChaserIcon from '@/assets/images/personality/types/storm-chaser.png'
import tideKeeperIcon from '@/assets/images/personality/types/tide-keeper.png'
import wandererIcon from '@/assets/images/personality/types/wanderer.png'

const TYPE_ICONS = {
  'storm-chaser': stormChaserIcon,
  'tide-keeper': tideKeeperIcon,
  poet: poetIcon,
  daydreamer: daydreamerIcon,
  spark: sparkIcon,
  wanderer: wandererIcon,
}

export function typeIcon(typeId) {
  return TYPE_ICONS[typeId] ?? starIcon
}
