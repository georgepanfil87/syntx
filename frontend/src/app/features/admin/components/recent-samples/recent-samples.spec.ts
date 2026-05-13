import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentSamples } from './recent-samples';

describe('RecentSamples', () => {
  let component: RecentSamples;
  let fixture: ComponentFixture<RecentSamples>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentSamples]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentSamples);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
