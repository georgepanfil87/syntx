import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeadlineTiles } from './headline-tiles';

describe('HeadlineTiles', () => {
  let component: HeadlineTiles;
  let fixture: ComponentFixture<HeadlineTiles>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeadlineTiles]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeadlineTiles);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
