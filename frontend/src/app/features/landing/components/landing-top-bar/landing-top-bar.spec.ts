import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LandingTopBar } from './landing-top-bar';

describe('LandingTopBar', () => {
  let component: LandingTopBar;
  let fixture: ComponentFixture<LandingTopBar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingTopBar]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LandingTopBar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
