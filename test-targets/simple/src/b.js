import { v4 } from 'uuid'

export const B = {
  returnString: () => v4(),
  returnObject: () => ({ hello: 'world'})
}