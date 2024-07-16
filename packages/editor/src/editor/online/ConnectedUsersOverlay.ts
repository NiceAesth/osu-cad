import {
  Anchor,
  Axes,
  Container,
  DrawableSprite,
  FillDirection,
  FillFlowContainer,
  RoundedBox,
  Vec2,
  dependencyLoader,
  resolved,
} from 'osucad-framework';
import type { UserSessionInfo } from '@osucad/common';
import { Assets, Color, Graphics } from 'pixi.js';
import gsap from 'gsap';
import { ConnectedUsersManager } from '../context/ConnectedUsersManager';
import { OsucadSpriteText } from '../../OsucadSpriteText';
import { UISamples } from '../../UISamples';

export class ConnectedUsersOverlay extends Container {
  @resolved(ConnectedUsersManager)
  private users!: ConnectedUsersManager;

  constructor() {
    super({
      relativeSizeAxes: Axes.X,
      height: 24,
      padding: { right: 16 },
    });
  }

  #items = new FillFlowContainer({
    direction: FillDirection.Horizontal,
    relativeSizeAxes: Axes.X,
    autoSizeAxes: Axes.Y,
    spacing: new Vec2(8),
    layoutDuration: 500,
    layoutEasing: 'back.out',
    anchor: Anchor.BottomRight,
    origin: Anchor.BottomRight,
    y: -20,
  });

  get content() {
    return this.#items;
  }

  @resolved(UISamples)
  private samples!: UISamples;

  #avatarMap = new Map<number, UserAvatar>();

  count = 0;

  @dependencyLoader()
  load() {
    this.addAllInternal(this.#items, this.#textFlow);

    for (const user of this.users.users) {
      const avatar = new UserAvatar(user);
      this.#items.insert(this.count--, avatar);
      this.#avatarMap.set(user.sessionId, avatar);
    }

    this.users.userJoined.addListener((user) => {
      const avatar = new UserAvatar(user);
      avatar.x = 20;
      avatar.rotation = Math.PI / 2;

      avatar.rotateTo({ rotation: 0, duration: 500, easing: 'back.out' });

      this.#items.insert(this.count--, avatar);
      this.#avatarMap.set(user.sessionId, avatar);

      this.showText(`${user.username} joined`, user.color);

      this.samples.userJoined.play();
    });

    this.users.userLeft.addListener((user) => {
      const avatar = this.#avatarMap.get(user.sessionId);
      if (avatar) {
        this.#items.remove(avatar);
        this.#avatarMap.delete(user.sessionId);
        this.showText(`${user.username} left`, user.color);

        this.samples.userLeft.play();
      }
    });
  }

  #textFlow = new FillFlowContainer({
    direction: FillDirection.Vertical,
    relativeSizeAxes: Axes.X,
    autoSizeAxes: Axes.Y,
    spacing: new Vec2(4),
    layoutDuration: 200,
    layoutEasing: 'power3.out',
    anchor: Anchor.BottomRight,
    origin: Anchor.BottomRight,
    y: -40,
    x: 16,
  });

  showText(text: string, color: string) {
    const drawable = new OsucadSpriteText({
      text,
      fontSize: 14,
      color,
      anchor: Anchor.BottomRight,
      origin: Anchor.BottomRight,
    });

    const container = new Container({
      relativeSizeAxes: Axes.X,
      autoSizeAxes: Axes.Y,
      child: drawable,
      anchor: Anchor.BottomRight,
      origin: Anchor.BottomRight,
    });
    drawable.blendMode = 'add';

    this.#textFlow.insert(--this.count, container);

    gsap.from(drawable, {
      x: 50,
      alpha: 0,
      duration: 0.3,
      ease: 'power3.out',
    });

    this.scheduler.addDelayed(() => {
      gsap.to(drawable, {
        x: 25,
        alpha: 0,
        duration: 0.3,
        ease: 'power3.in',
        onComplete: () => {
          this.#textFlow.remove(container);
        },
      });
    }, 5000);
  }
}

class UserAvatar extends Container {
  constructor(user: UserSessionInfo) {
    super({
      width: 28,
      height: 28,
    });

    this.anchor = Anchor.BottomRight;
    this.origin = Anchor.Center;

    Assets.load({
      src: `/api/users/${user.id}/avatar`,
      loadParser: 'loadTextures',
    }).then((texture) => {
      if (!texture)
        return;

      const avatar = new DrawableSprite({
        relativeSizeAxes: Axes.Both,
        texture,
      });

      avatar.drawNode.mask = this.drawNode.addChild(
        new Graphics()
          .circle(14, 14, 14)
          .fill(),
      );

      this.add(avatar);

      this.add(new RoundedBox({
        width: 32,
        height: 32,
        anchor: Anchor.Center,
        origin: Anchor.Center,
        cornerRadius: 16,
        fillAlpha: 0,
        outline: {
          width: 1,
          color: Color.shared.setValue(user.color).toNumber(),
          alpha: 1,
          alignment: 1,
        },
      }));
    });
  }
}
